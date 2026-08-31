// @vitest-environment node
/**
 * Tests for `adminToggleAdmin` (Task 28), the action Task 1 fixed.
 *
 * The bug was silent and total: the toggle wrote `is_admin` through the
 * caller's own session client, and migration 045's `protect_admin_columns`
 * trigger reverts that column for every JWT role except `service_role`. The
 * update reported success, the audit row was written, and nothing changed in
 * the database. Nothing about the return value distinguishes the broken version
 * from the fixed one — so the regression test has to assert *which client did
 * the write*, which is what the first case here does.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const requireAdmin = vi.fn();
const checkRateLimit = vi.fn();
const createAuditLog = vi.fn();
const revalidatePath = vi.fn();

/** The service-role write. Captured so tests can see what it was given. */
const adminUpdate = vi.fn();
const adminEq = vi.fn();
const adminFrom = vi.fn();

/** The caller's session client — must never be the one writing `is_admin`. */
const sessionUpdate = vi.fn();
const sessionFrom = vi.fn();
const sessionInsert = vi.fn();
const profileSingle = vi.fn();

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: () => requireAdmin(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: adminFrom }),
}));

vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}));

vi.mock("@/lib/utils/audit-log", () => ({
  createAuditLog: (...args: unknown[]) => createAuditLog(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

import { adminToggleAdmin } from "@/lib/actions/admin-users";

const ADMIN = { id: "11111111-1111-4111-8111-111111111111" };
const TARGET = "550e8400-e29b-41d4-a716-446655440000";

/** Wire both clients up for a successful toggle of `TARGET`. */
function arrange({ targetIsAdmin = false }: { targetIsAdmin?: boolean } = {}) {
  profileSingle.mockResolvedValue({
    data: { is_admin: targetIsAdmin, username: "ada" },
  });

  sessionFrom.mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({ eq: () => ({ single: profileSingle }) }),
        update: sessionUpdate,
      };
    }
    return { insert: sessionInsert };
  });
  sessionUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  sessionInsert.mockResolvedValue({ error: null });

  adminEq.mockResolvedValue({ error: null });
  adminUpdate.mockReturnValue({ eq: adminEq });
  adminFrom.mockReturnValue({ update: adminUpdate });

  requireAdmin.mockResolvedValue({
    supabase: { from: sessionFrom },
    user: ADMIN,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({ allowed: true });
});

describe("adminToggleAdmin: the Task 1 regression", () => {
  it("writes is_admin through the service-role client, not the session one", async () => {
    arrange();

    const result = await adminToggleAdmin(TARGET);

    expect(result).toMatchObject({ success: true, isAdmin: true });

    // The write itself must go through createAdminClient(); anything else is
    // silently reverted by the protect_admin_columns trigger.
    expect(adminFrom).toHaveBeenCalledWith("profiles");
    expect(adminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_admin: true })
    );
    expect(adminEq).toHaveBeenCalledWith("id", TARGET);

    // And the session client must not have attempted it.
    expect(sessionUpdate).not.toHaveBeenCalled();
  });

  it("records who granted the role and when", async () => {
    arrange();

    await adminToggleAdmin(TARGET);

    expect(adminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        is_admin: true,
        admin_granted_by: ADMIN.id,
        admin_granted_at: expect.any(String),
      })
    );
  });

  it("clears those fields on revoke rather than leaving stale provenance", async () => {
    arrange({ targetIsAdmin: true });

    const result = await adminToggleAdmin(TARGET);

    expect(result).toMatchObject({ success: true, isAdmin: false });
    expect(adminUpdate).toHaveBeenCalledWith({
      is_admin: false,
      admin_granted_at: null,
      admin_granted_by: null,
    });
  });

  it("audits the change", async () => {
    arrange();

    await adminToggleAdmin(TARGET, "promoted for moderation duty");

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.user.toggle_admin",
        targetId: TARGET,
        userId: ADMIN.id,
      })
    );
  });
});

describe("adminToggleAdmin: refusals", () => {
  it("refuses a caller who is not an admin, without writing anything", async () => {
    requireAdmin.mockRejectedValue(new Error("Not authorized"));

    const result = await adminToggleAdmin(TARGET);

    expect(result).toEqual({
      success: false,
      error: "Failed to update admin status",
    });
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller", async () => {
    requireAdmin.mockRejectedValue(new Error("Not authenticated"));

    expect(await adminToggleAdmin(TARGET)).toMatchObject({ success: false });
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("will not let an admin change their own status", async () => {
    arrange();

    const result = await adminToggleAdmin(ADMIN.id);

    expect(result).toEqual({
      success: false,
      error: "Cannot change your own admin status",
    });
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("rejects a malformed user id before touching the database", async () => {
    arrange();

    const result = await adminToggleAdmin("../../etc/passwd");

    expect(result).toMatchObject({ success: false });
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("stops at the rate limit", async () => {
    arrange();
    checkRateLimit.mockResolvedValue({ allowed: false });

    const result = await adminToggleAdmin(TARGET);

    expect(result).toEqual({
      success: false,
      error: "Too many requests. Please wait a moment.",
    });
    expect(checkRateLimit).toHaveBeenCalledWith(`admin:${ADMIN.id}`, 30, 60000);
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("reports a missing target instead of writing a row for nobody", async () => {
    arrange();
    profileSingle.mockResolvedValue({ data: null });

    const result = await adminToggleAdmin(TARGET);

    expect(result).toEqual({ success: false, error: "User not found" });
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("returns a client-safe message when the write fails", async () => {
    arrange();
    adminEq.mockResolvedValue({
      error: { code: "42501", message: 'permission denied for table "profiles"' },
    });

    const result = await adminToggleAdmin(TARGET);

    expect(result).toEqual({
      success: false,
      error: "Failed to update admin status",
    });
    // The raw Postgres text must not reach the browser.
    expect(JSON.stringify(result)).not.toContain("permission denied");
  });
});
