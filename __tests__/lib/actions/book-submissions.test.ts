// @vitest-environment node
/**
 * Tests for `moderateSubmission` (Phase 2, Task 6).
 *
 * Two properties: a rejection that touched no row (RLS refused, or someone
 * else moderated it first) must fail and never write an audit row; and an
 * approval goes through the `approve_book_submission` RPC — the only place a
 * catalog row is created from a submission — with the caller as moderator.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const checkAdmin = vi.fn();
const checkRateLimit = vi.fn();
const createAuditLog = vi.fn();

const submissionSingle = vi.fn();
const rejectSelect = vi.fn();
const update = vi.fn();
const bookSlugSingle = vi.fn();
const rpc = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/auth/require-admin", () => ({
  checkAdmin: () => checkAdmin(),
}));

vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}));

vi.mock("@/lib/utils/audit-log", () => ({
  createAuditLog: (...args: unknown[]) => createAuditLog(...args),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/cache/tags", () => ({
  BOOK_CATALOG_TAGS: ["books"],
  invalidateTags: vi.fn(),
}));

import { moderateSubmission } from "@/lib/actions/book-submissions";

const ADMIN = { id: "11111111-1111-4111-8111-111111111111" };
const SUBMITTER = "22222222-2222-4222-8222-222222222222";
const SUBMISSION = "550e8400-e29b-41d4-a716-446655440000";
const NEW_BOOK = "33333333-3333-4333-8333-333333333333";

function arrange({
  status = "pending",
  rejectedRows = [{ id: SUBMISSION }],
}: { status?: string; rejectedRows?: Array<{ id: string }> } = {}) {
  submissionSingle.mockResolvedValue({
    data: {
      id: SUBMISSION,
      status,
      title: "Dune",
      author: "Frank Herbert",
      submitted_by: SUBMITTER,
    },
    error: null,
  });
  rejectSelect.mockResolvedValue({ data: rejectedRows, error: null });
  update.mockReturnValue({ eq: () => ({ select: rejectSelect }) });
  bookSlugSingle.mockResolvedValue({ data: { slug: "dune" }, error: null });
  rpc.mockResolvedValue({ data: NEW_BOOK, error: null });

  from.mockImplementation((table: string) => {
    if (table === "book_submissions") {
      return {
        select: () => ({ eq: () => ({ single: submissionSingle }) }),
        update,
      };
    }
    if (table === "books") {
      return { select: () => ({ eq: () => ({ single: bookSlugSingle }) }) };
    }
    throw new Error(`unexpected table ${table}`);
  });

  checkAdmin.mockResolvedValue({ ok: true, supabase: { from, rpc }, user: ADMIN });
  checkRateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetIn: 60000 });
  createAuditLog.mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("moderateSubmission — reject", () => {
  it("fails, and writes no audit row, when the update touched no row", async () => {
    arrange({ rejectedRows: [] });

    const result = await moderateSubmission({
      submissionId: SUBMISSION,
      action: "reject",
      rejectionReason: "duplicate",
    });

    expect(result).toEqual({ success: false, error: "Nothing was changed" });
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("marks the row rejected by the caller and records it", async () => {
    arrange();

    const result = await moderateSubmission({
      submissionId: SUBMISSION,
      action: "reject",
      rejectionReason: "duplicate",
    });

    expect(result).toEqual({ success: true, action: "rejected" });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        moderated_by: ADMIN.id,
        rejection_reason: "duplicate",
      })
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "moderation.book.reject",
        targetId: SUBMISSION,
        metadata: expect.objectContaining({ submittedBy: SUBMITTER }),
      })
    );
  });

  it("refuses to moderate a submission twice", async () => {
    arrange({ status: "approved" });

    const result = await moderateSubmission({
      submissionId: SUBMISSION,
      action: "reject",
    });

    expect(result).toEqual({ success: false, error: "Submission has already been moderated" });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("moderateSubmission — approve", () => {
  it("creates the book through the guarded RPC with the caller as moderator", async () => {
    arrange();

    const result = await moderateSubmission({
      submissionId: SUBMISSION,
      action: "approve",
    });

    expect(result).toEqual({ success: true, action: "approved", bookId: NEW_BOOK });
    expect(rpc).toHaveBeenCalledWith("approve_book_submission", {
      p_submission_id: SUBMISSION,
      p_moderator_id: ADMIN.id,
    });
    // No hand-rolled insert into `books` — the RPC is the only path.
    expect(update).not.toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "moderation.book.approve",
        metadata: expect.objectContaining({ bookId: NEW_BOOK, bookSlug: "dune" }),
      })
    );
  });

  it("fails without an audit row when the RPC refuses", async () => {
    arrange();
    rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "Only admins can approve submissions" },
    });

    const result = await moderateSubmission({
      submissionId: SUBMISSION,
      action: "approve",
    });

    expect(result).toEqual({ success: false, error: "Failed to approve submission" });
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("refuses a caller who is not an admin", async () => {
    checkAdmin.mockResolvedValue({
      ok: false,
      reason: "unauthorized",
      error: "Not authorized",
    });

    const result = await moderateSubmission({
      submissionId: SUBMISSION,
      action: "approve",
    });

    expect(result).toEqual({ success: false, error: "Not authorized to moderate submissions" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
