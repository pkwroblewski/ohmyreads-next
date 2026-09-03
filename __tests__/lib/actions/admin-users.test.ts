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
const adminSelect = vi.fn();
const adminFrom = vi.fn();
const updateUserById = vi.fn();

/** The caller's session client — must never be the one writing `is_admin`. */
const sessionUpdate = vi.fn();
const sessionFrom = vi.fn();
const sessionInsert = vi.fn();
const profileSingle = vi.fn();

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: () => requireAdmin(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: adminFrom,
    auth: { admin: { updateUserById } },
  }),
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

import {
  adminToggleAdmin,
  adminDisableUser,
  adminEnableUser,
} from "@/lib/actions/admin-users";

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
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/users/${TARGET}`);
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

/**
 * Disable / enable (Phase 2, Task 7). Before this the "disable" action wrote
 * an audit row and nothing else: no column, no session revocation, no gate.
 */
function arrangeAccount({
  isAdmin = false,
  disabledAt = null as string | null,
  rows = [{ id: TARGET }],
} = {}) {
  profileSingle.mockResolvedValue({
    data: { username: "ada", is_admin: isAdmin, disabled_at: disabledAt },
  });
  sessionFrom.mockImplementation(() => ({
    select: () => ({ eq: () => ({ single: profileSingle }) }),
    update: sessionUpdate,
  }));

  adminSelect.mockResolvedValue({ data: rows, error: null });
  adminUpdate.mockReturnValue({ eq: () => ({ select: adminSelect }) });
  adminFrom.mockReturnValue({ update: adminUpdate });
  updateUserById.mockResolvedValue({ data: {}, error: null });

  requireAdmin.mockResolvedValue({
    supabase: { from: sessionFrom },
    user: ADMIN,
  });
}

describe("adminDisableUser", () => {
  it("sets disabled_at through the service-role client and bans the auth user", async () => {
    arrangeAccount();

    const result = await adminDisableUser(TARGET, "spam");

    expect(result).toMatchObject({ success: true });
    expect(adminFrom).toHaveBeenCalledWith("profiles");
    expect(adminUpdate).toHaveBeenCalledWith({ disabled_at: expect.any(String) });
    expect(updateUserById).toHaveBeenCalledWith(TARGET, { ban_duration: "876000h" });
    // The session client must not have attempted the write: the trigger
    // would silently revert it.
    expect(sessionUpdate).not.toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.user.disable",
        targetId: TARGET,
        metadata: expect.objectContaining({ reason: "spam", banApplied: true }),
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/users/${TARGET}`);
  });

  it("refuses to disable an admin, without writing anything", async () => {
    arrangeAccount({ isAdmin: true });

    const result = await adminDisableUser(TARGET);

    expect(result).toEqual({ success: false, error: "Cannot disable admin accounts" });
    expect(adminFrom).not.toHaveBeenCalled();
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("refuses to disable yourself", async () => {
    arrangeAccount();

    const result = await adminDisableUser(ADMIN.id);

    expect(result).toEqual({ success: false, error: "Cannot disable your own account" });
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("says so when the account is already disabled", async () => {
    arrangeAccount({ disabledAt: "2026-09-01T00:00:00Z" });

    const result = await adminDisableUser(TARGET);

    expect(result).toEqual({ success: false, error: "This account is already disabled" });
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("fails, without a ban or an audit row, when the update touched no row", async () => {
    arrangeAccount({ rows: [] });

    const result = await adminDisableUser(TARGET);

    expect(result).toEqual({ success: false, error: "Nothing was changed" });
    expect(updateUserById).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("reports a failed ban honestly instead of claiming the account is locked out", async () => {
    arrangeAccount();
    updateUserById.mockResolvedValue({ data: null, error: { message: "auth down" } });

    const result = await adminDisableUser(TARGET);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/could not be revoked/);
    // The column is set and the audit row says the ban did not apply.
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ banApplied: false }),
      })
    );
  });
});

describe("adminEnableUser", () => {
  it("clears disabled_at through the service-role client and lifts the ban", async () => {
    arrangeAccount({ disabledAt: "2026-09-01T00:00:00Z" });

    const result = await adminEnableUser(TARGET);

    expect(result).toMatchObject({ success: true });
    expect(adminUpdate).toHaveBeenCalledWith({ disabled_at: null });
    expect(updateUserById).toHaveBeenCalledWith(TARGET, { ban_duration: "none" });
    expect(sessionUpdate).not.toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.user.enable",
        targetId: TARGET,
        metadata: expect.objectContaining({ banLifted: true }),
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/users/${TARGET}`);
  });

  it("says so when the account is not disabled", async () => {
    arrangeAccount();

    const result = await adminEnableUser(TARGET);

    expect(result).toEqual({ success: false, error: "This account is not disabled" });
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("fails, without lifting the ban, when the update touched no row", async () => {
    arrangeAccount({ disabledAt: "2026-09-01T00:00:00Z", rows: [] });

    const result = await adminEnableUser(TARGET);

    expect(result).toEqual({ success: false, error: "Nothing was changed" });
    expect(updateUserById).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });
});
