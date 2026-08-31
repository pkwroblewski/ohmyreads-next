import { z } from "zod";

/**
 * Content types a reader can report. Kept in step with the `target_type` CHECK
 * in migration 062 — the database is the real gate, this is the friendly one.
 */
export const REPORT_TARGET_TYPES = [
  "review",
  "comment",
  "place_photo",
] as const;

export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

/**
 * Reasons, in the order they are offered. `other` is last and is the only one
 * where the free-text box carries the weight.
 */
export const REPORT_REASONS = [
  "spam",
  "harassment",
  "hate",
  "sexual_content",
  "violence",
  "misinformation",
  "off_topic",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/** Human labels for the reason picker and the admin queue. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam or advertising",
  harassment: "Harassment or bullying",
  hate: "Hate speech",
  sexual_content: "Sexual content",
  violence: "Violence or threats",
  misinformation: "Misinformation",
  off_topic: "Off topic or wrong book",
  other: "Something else",
};

export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  review: "Review",
  comment: "Comment",
  place_photo: "Place photo",
};

export const submitReportSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.string().uuid("Invalid content ID"),
  reason: z.enum(REPORT_REASONS),
  details: z
    .string()
    .trim()
    .max(1000, "Please keep the details under 1000 characters")
    .optional(),
});

export type SubmitReportInput = z.infer<typeof submitReportSchema>;

export const resolveReportSchema = z.object({
  reportId: z.string().uuid("Invalid report ID"),
  note: z
    .string()
    .trim()
    .max(1000, "Please keep the note under 1000 characters")
    .optional(),
});

export type ResolveReportInput = z.infer<typeof resolveReportSchema>;

export const REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
