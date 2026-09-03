"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { createAuditLog } from "@/lib/utils/audit-log";
import { logError, logger, reportError } from "@/lib/utils/log";
import {
  submitReportSchema,
  resolveReportSchema,
  type ReportTargetType,
  type SubmitReportInput,
} from "@/lib/validation/report";

/**
 * Which table owns each reportable content type, and which column names its
 * author. Used to answer two questions before a report is stored: does the
 * content exist, and is the reporter its author?
 */
const TARGET_TABLES: Record<ReportTargetType, "reviews" | "comments" | "place_photos"> = {
  review: "reviews",
  comment: "comments",
  place_photo: "place_photos",
};

type ActionResult = { success: boolean; error?: string };

/**
 * File a report against a review, comment or place photo.
 *
 * Refuses silently-useless reports up front — content that no longer exists,
 * and your own content — so the queue an admin works through is only things
 * somebody else actually needs to look at.
 */
export async function submitReport(
  input: SubmitReportInput
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await getUser();

    if (!user) {
      return { success: false, error: "Please sign in to report content" };
    }

    const parsed = submitReportSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid report",
      };
    }
    const { targetType, targetId, reason, details } = parsed.data;

    // 10 reports per 10 minutes. Generous for anyone reading in good faith,
    // and the UNIQUE constraint already stops repeat reports of one item.
    const { allowed } = await checkRateLimit(`report:${user.id}`, 10, 600000);
    if (!allowed) {
      return {
        success: false,
        error: "Too many reports. Please wait a few minutes.",
      };
    }

    const { data: target, error: targetError } = await supabase
      .from(TARGET_TABLES[targetType])
      .select("id, user_id")
      .eq("id", targetId)
      .maybeSingle();

    if (targetError) {
      return {
        success: false,
        error: reportError("Error loading report target", targetError, {
          targetType,
        }),
      };
    }

    if (!target) {
      return { success: false, error: "That content no longer exists" };
    }

    if (target.user_id === user.id) {
      return { success: false, error: "You cannot report your own content" };
    }

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details || null,
    });

    if (error) {
      // 23505: the one-report-per-reporter-per-target unique constraint. Racing
      // two submissions lands here rather than on a read-then-write check.
      if (error.code === "23505") {
        return {
          success: false,
          error: "You have already reported this — thanks, we're on it",
        };
      }

      return {
        success: false,
        error: reportError("Error submitting report", error, { targetType }),
      };
    }

    revalidatePath("/admin/reports");

    return { success: true };
  } catch (error) {
    logError("Unexpected error in submitReport", error);
    return { success: false, error: "Could not submit that report" };
  }
}

/** Shared body for the two admin outcomes, which differ only in the status. */
async function closeReport(
  reportId: string,
  note: string | undefined,
  status: "resolved" | "dismissed"
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAdmin();

    const parsed = resolveReportSchema.safeParse({ reportId, note });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input",
      };
    }

    const { allowed } = await checkRateLimit(`admin:${user.id}`, 30, 60000);
    if (!allowed) {
      return {
        success: false,
        error: "Too many requests. Please wait a moment.",
      };
    }

    // Read first so the audit entry can say what was closed, and so a report
    // that is already closed is reported as such instead of silently re-closed.
    const { data: report } = await supabase
      .from("reports")
      .select("id, status, target_type, target_id")
      .eq("id", parsed.data.reportId)
      .maybeSingle();

    if (!report) {
      return { success: false, error: "Report not found" };
    }

    if (report.status !== "open") {
      return { success: false, error: `This report is already ${report.status}` };
    }

    const { data: closed, error } = await supabase
      .from("reports")
      .update({
        status,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        resolution_note: parsed.data.note || null,
      })
      .eq("id", parsed.data.reportId)
      // Only close a report that is still open, so two admins acting at once
      // cannot overwrite each other's outcome.
      .eq("status", "open")
      .select("id");

    if (error) {
      return {
        success: false,
        error: reportError("Error closing report", error, { status }),
      };
    }
    // The other admin won the race (or RLS refused): no row, no audit entry.
    if (!closed || closed.length === 0) {
      logger.error("Report close changed no rows", { reportId: report.id, status });
      return { success: false, error: "Nothing was changed" };
    }

    await createAuditLog({
      action: status === "resolved" ? "moderation.report.resolve" : "moderation.report.dismiss",
      targetType: "report",
      targetId: report.id,
      userId: user.id,
      metadata: {
        reportedType: report.target_type,
        reportedId: report.target_id,
        note: parsed.data.note || null,
      },
    });

    revalidatePath("/admin/reports");

    return { success: true };
  } catch (error) {
    logError("Unexpected error closing report", error, { status });
    return { success: false, error: "Could not update that report" };
  }
}

/** Mark a report actioned — the content was dealt with. */
export async function resolveReport(
  reportId: string,
  note?: string
): Promise<ActionResult> {
  return closeReport(reportId, note, "resolved");
}

/** Close a report without action — nothing was wrong with the content. */
export async function dismissReport(
  reportId: string,
  note?: string
): Promise<ActionResult> {
  return closeReport(reportId, note, "dismissed");
}
