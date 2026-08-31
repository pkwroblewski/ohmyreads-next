// @vitest-environment node
/**
 * Tests for the reporting server actions (Task 30).
 *
 * The database guarantees — RLS, the one-report-per-target UNIQUE, the trigger
 * that forces a new report to `open` — are verified in SQL against production
 * inside a rolled-back transaction. What is left, and what these cover, is the
 * layer above: the refusals that keep useless rows out of the moderation queue,
 * the translation of a 23505 into something a person can read, and the fact
 * that closing a report is admin-only and audited.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const getUser = vi.fn();
const requireAdmin = vi.fn();
const checkRateLimit = vi.fn();
const createAuditLog = vi.fn();

/** Per-table handlers for the reporter's session client. */
const targetMaybeSingle = vi.fn();
const reportsInsert = vi.fn();
const sessionFrom = vi.fn();

/** The admin client, used by resolve/dismiss. */
const reportMaybeSingle = vi.fn();
const reportsUpdateEq2 = vi.fn();
const reportsUpdateEq1 = vi.fn();
const reportsUpdate = vi.fn();
const adminFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from: sessionFrom }),
}));

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: () => requireAdmin(),
}));

vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}));

vi.mock("@/lib/utils/audit-log", () => ({
  createAuditLog: (...args: unknown[]) => createAuditLog(...args),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { submitReport, resolveReport, dismissReport } from "@/lib/actions/reports";

const REPORTER = "5ea44a01-72a1-43b5-86f5-238b65160a55";
const AUTHOR = "cf57144d-0825-41e2-bc61-b5c58c9a4158";
const REVIEW = "c686c986-3786-4530-8f01-8aa8527caaa5";
const REPORT = "741a5d89-7688-4932-8b63-c54e1bff05a6";

const VALID = {
  targetType: "review" as const,
  targetId: REVIEW,
  reason: "spam" as const,
};

function arrangeReporter({ targetOwner = AUTHOR }: { targetOwner?: string | null } = {}) {
  getUser.mockResolvedValue({ data: { user: { id: REPORTER } } });

  targetMaybeSingle.mockResolvedValue({
    data: targetOwner ? { id: REVIEW, user_id: targetOwner } : null,
    error: null,
  });
  reportsInsert.mockResolvedValue({ error: null });

  sessionFrom.mockImplementation((table: string) => {
    if (table === "reports") return { insert: reportsInsert };
    return {
      select: () => ({ eq: () => ({ maybeSingle: targetMaybeSingle }) }),
    };
  });
}

function arrangeAdmin({ status = "open" }: { status?: string } = {}) {
  reportMaybeSingle.mockResolvedValue({
    data: { id: REPORT, status, target_type: "review", target_id: REVIEW },
  });
  reportsUpdateEq2.mockResolvedValue({ error: null });
  reportsUpdateEq1.mockReturnValue({ eq: reportsUpdateEq2 });
  reportsUpdate.mockReturnValue({ eq: reportsUpdateEq1 });

  adminFrom.mockImplementation(() => ({
    select: () => ({ eq: () => ({ maybeSingle: reportMaybeSingle }) }),
    update: reportsUpdate,
  }));

  requireAdmin.mockResolvedValue({
    supabase: { from: adminFrom },
    user: { id: "468fd5e6-646f-41cc-8dda-ac867603c4cb" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({ allowed: true });
});

describe("submitReport", () => {
  it("stores a report against someone else's content", async () => {
    arrangeReporter();

    const result = await submitReport({ ...VALID, details: "  ad spam  " });

    expect(result).toEqual({ success: true });
    expect(reportsInsert).toHaveBeenCalledWith({
      reporter_id: REPORTER,
      target_type: "review",
      target_id: REVIEW,
      reason: "spam",
      details: "ad spam",
    });
  });

  it("requires a session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const result = await submitReport(VALID);

    expect(result).toEqual({
      success: false,
      error: "Please sign in to report content",
    });
    expect(reportsInsert).not.toHaveBeenCalled();
  });

  it("refuses a report of your own content", async () => {
    arrangeReporter({ targetOwner: REPORTER });

    const result = await submitReport(VALID);

    expect(result).toEqual({
      success: false,
      error: "You cannot report your own content",
    });
    expect(reportsInsert).not.toHaveBeenCalled();
  });

  it("refuses a report of content that no longer exists", async () => {
    arrangeReporter({ targetOwner: null });

    const result = await submitReport(VALID);

    expect(result).toEqual({
      success: false,
      error: "That content no longer exists",
    });
    expect(reportsInsert).not.toHaveBeenCalled();
  });

  it("turns the UNIQUE violation into something a person can read", async () => {
    arrangeReporter();
    // 23505 = reports_one_per_reporter_per_target. Catching it rather than
    // reading first is what makes two concurrent submissions safe.
    reportsInsert.mockResolvedValue({ error: { code: "23505" } });

    const result = await submitReport(VALID);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already reported/i);
  });

  it("never leaks raw Postgres text on an unexpected failure", async () => {
    arrangeReporter();
    reportsInsert.mockResolvedValue({
      error: {
        code: "42501",
        message: 'new row violates row-level security policy for table "reports"',
      },
    });

    const result = await submitReport(VALID);

    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain("row-level security");
  });

  it("stops at the rate limit before touching the database", async () => {
    arrangeReporter();
    checkRateLimit.mockResolvedValue({ allowed: false });

    const result = await submitReport(VALID);

    expect(result.success).toBe(false);
    expect(checkRateLimit).toHaveBeenCalledWith(`report:${REPORTER}`, 10, 600000);
    expect(reportsInsert).not.toHaveBeenCalled();
  });

  it("rejects an unknown target type or reason", async () => {
    arrangeReporter();

    const badType = await submitReport({
      ...VALID,
      targetType: "profile" as never,
    });
    const badReason = await submitReport({
      ...VALID,
      reason: "i-just-dont-like-it" as never,
    });
    const badId = await submitReport({ ...VALID, targetId: "not-a-uuid" });

    for (const result of [badType, badReason, badId]) {
      expect(result.success).toBe(false);
    }
    expect(reportsInsert).not.toHaveBeenCalled();
  });
});

describe("resolveReport / dismissReport", () => {
  it("closes an open report and audits who did it", async () => {
    arrangeAdmin();

    const result = await resolveReport(REPORT, "review deleted");

    expect(result).toEqual({ success: true });
    expect(reportsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "resolved",
        resolved_by: "468fd5e6-646f-41cc-8dda-ac867603c4cb",
        resolution_note: "review deleted",
      })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "moderation.report.resolve",
        targetType: "report",
        targetId: REPORT,
      })
    );
  });

  it("dismisses with its own audit action", async () => {
    arrangeAdmin();

    await dismissReport(REPORT);

    expect(reportsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "dismissed" })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "moderation.report.dismiss" })
    );
  });

  it("scopes the write to reports that are still open", async () => {
    arrangeAdmin();

    await resolveReport(REPORT);

    // The second .eq() is `status = 'open'`, so two admins acting at once
    // cannot overwrite each other's outcome.
    expect(reportsUpdateEq1).toHaveBeenCalledWith("id", REPORT);
    expect(reportsUpdateEq2).toHaveBeenCalledWith("status", "open");
  });

  it("refuses a caller who is not an admin", async () => {
    requireAdmin.mockRejectedValue(new Error("Not authorized"));

    const result = await resolveReport(REPORT);

    expect(result.success).toBe(false);
    expect(adminFrom).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("says so when the report was already closed", async () => {
    arrangeAdmin({ status: "dismissed" });

    const result = await resolveReport(REPORT);

    expect(result).toEqual({
      success: false,
      error: "This report is already dismissed",
    });
    expect(reportsUpdate).not.toHaveBeenCalled();
  });

  it("reports a missing report rather than writing nothing quietly", async () => {
    arrangeAdmin();
    reportMaybeSingle.mockResolvedValue({ data: null });

    expect(await resolveReport(REPORT)).toEqual({
      success: false,
      error: "Report not found",
    });
  });

  it("stops at the admin rate limit", async () => {
    arrangeAdmin();
    checkRateLimit.mockResolvedValue({ allowed: false });

    const result = await resolveReport(REPORT);

    expect(result.success).toBe(false);
    expect(reportsUpdate).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });
});
