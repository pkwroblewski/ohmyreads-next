"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { checkAdmin } from "@/lib/auth/require-admin";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { encodeGeohash } from "@/lib/utils/geohash";
import { createAuditLog } from "@/lib/utils/audit-log";
import { logError } from "@/lib/utils/log";
import {
  submitPlaceSchema,
  placeModerationSchema,
} from "@/lib/validation/place";
import type { ActionResult } from "@/types/app";

// ============================================
// TYPES
// ============================================

interface SubmitPlaceInput {
  name: string;
  placeType: "bookstore" | "library" | "cafe" | "bookclub" | "popup" | "other";
  address?: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  website?: string;
  description?: string;
}

// ============================================
// SUBMIT PLACE
// ============================================

/**
 * Submit a new place for moderation
 */
export async function submitPlace(input: SubmitPlaceInput): Promise<ActionResult<{ submissionId: string }>> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: "You must be logged in to submit a place" };
    }
    const { supabase, user } = auth;

    // Rate limit (5 submissions per hour)
    const { allowed } = await checkRateLimit(`place-submit:${user.id}`, 5, 3600000);
    if (!allowed) {
      return { success: false, error: "You've submitted too many places recently. Please try again later." };
    }

    // Validate input with Zod
    const validationResult = submitPlaceSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const place = validationResult.data;

    // Generate geohash if coordinates provided (0 is a valid coordinate)
    const coords =
      place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null;
    const geohash = coords ? encodeGeohash(coords.lat, coords.lng, 7) : null;

    // Insert submission
    const { data, error } = await supabase
      .from("place_submissions")
      .insert({
        name: place.name,
        place_type: place.placeType,
        address: place.address || null,
        city: place.city || null,
        country: place.country || null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        geohash,
        website: place.website?.trim() || null,
        description: place.description?.trim() || null,
        submitted_by: user.id,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      logError("Error submitting place", error);
      return { success: false, error: "Failed to submit place" };
    }

    return { success: true, submissionId: data.id };
  } catch (error) {
    logError("Error in submitPlace", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================
// GET USER SUBMISSIONS
// ============================================

// ============================================
// ADMIN: GET PENDING SUBMISSIONS
// ============================================

// ============================================
// ADMIN: APPROVE SUBMISSION
// ============================================

/**
 * Approve a place submission (admin only)
 */
export async function approvePlaceSubmission(submissionId: string, notes?: string): Promise<ActionResult<{ placeId: string }>> {
  try {
    const admin = await checkAdmin();

    if (!admin.ok) {
      return { success: false, error: admin.error };
    }

    const { supabase, user } = admin;

    // Validate input with Zod
    const validationResult = placeModerationSchema.safeParse({
      submissionId,
      notes,
    });
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    // Fetch submission for audit log
    const { data: submission } = await supabase
      .from("place_submissions")
      .select("name, place_type, city, country, submitted_by")
      .eq("id", submissionId)
      .single();

    // Call the database function to approve
    const { data, error } = await supabase.rpc("approve_place_submission", {
      submission_id: submissionId,
      admin_notes: notes || undefined,
    });

    if (error) {
      logError("Error approving submission", error);
      return { success: false, error: "Failed to approve submission" };
    }

    // Audit log
    await createAuditLog({
      action: "moderation.place.approve",
      targetType: "place_submission",
      targetId: submissionId,
      userId: user.id,
      metadata: {
        placeName: submission?.name,
        placeType: submission?.place_type,
        city: submission?.city,
        country: submission?.country,
        placeId: data,
        submittedBy: submission?.submitted_by,
        adminNotes: notes || null,
      },
    });

    revalidatePath("/admin/moderation/places");
    revalidatePath("/community/map");

    return { success: true, placeId: data };
  } catch (error) {
    logError("Error in approvePlaceSubmission", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================
// ADMIN: REJECT SUBMISSION
// ============================================

/**
 * Reject a place submission (admin only)
 */
export async function rejectPlaceSubmission(submissionId: string, notes?: string): Promise<ActionResult> {
  try {
    const admin = await checkAdmin();

    if (!admin.ok) {
      return { success: false, error: admin.error };
    }

    const { supabase, user } = admin;

    // Validate input with Zod
    const validationResult = placeModerationSchema.safeParse({
      submissionId,
      notes,
    });
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    // Fetch submission for audit log
    const { data: submission } = await supabase
      .from("place_submissions")
      .select("name, place_type, city, country, submitted_by")
      .eq("id", submissionId)
      .single();

    // Call the database function to reject
    const { data: rejected, error } = await supabase.rpc("reject_place_submission", {
      submission_id: submissionId,
      admin_notes: notes || undefined,
    });

    if (error) {
      logError("Error rejecting submission", error);
      return { success: false, error: "Failed to reject submission" };
    }

    // false = no pending submission with this id (already reviewed or gone)
    if (!rejected) {
      return { success: false, error: "Submission not found or already reviewed" };
    }

    // Audit log
    await createAuditLog({
      action: "moderation.place.reject",
      targetType: "place_submission",
      targetId: submissionId,
      userId: user.id,
      metadata: {
        placeName: submission?.name,
        placeType: submission?.place_type,
        city: submission?.city,
        country: submission?.country,
        rejectionReason: notes || null,
        submittedBy: submission?.submitted_by,
      },
    });

    revalidatePath("/admin/moderation/places");

    return { success: true };
  } catch (error) {
    logError("Error in rejectPlaceSubmission", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

