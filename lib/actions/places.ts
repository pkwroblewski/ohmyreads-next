"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { encodeGeohash } from "@/lib/utils/geohash";
import { createAuditLog } from "@/lib/utils/audit-log";

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
export async function submitPlace(input: SubmitPlaceInput) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "You must be logged in to submit a place" };
    }

    // Rate limit (5 submissions per hour)
    const { allowed } = await checkRateLimit(`place-submit:${user.id}`, 5, 3600000);
    if (!allowed) {
      return { error: "You've submitted too many places recently. Please try again later." };
    }

    // Validate input
    if (!input.name || input.name.length < 2 || input.name.length > 200) {
      return { error: "Name must be between 2 and 200 characters" };
    }

    const validTypes = ["bookstore", "library", "cafe", "bookclub", "popup", "other"];
    if (!validTypes.includes(input.placeType)) {
      return { error: "Invalid place type" };
    }

    // Generate geohash if coordinates provided
    let geohash = null;
    if (input.lat && input.lng) {
      if (input.lat < -90 || input.lat > 90 || input.lng < -180 || input.lng > 180) {
        return { error: "Invalid coordinates" };
      }
      geohash = encodeGeohash(input.lat, input.lng, 7);
    }

    // Insert submission
    const { data, error } = await supabase
      .from("place_submissions")
      .insert({
        name: input.name.trim(),
        place_type: input.placeType,
        address: input.address?.trim() || null,
        city: input.city?.trim() || null,
        country: input.country?.trim() || null,
        lat: input.lat || null,
        lng: input.lng || null,
        geohash,
        website: input.website?.trim() || null,
        description: input.description?.trim() || null,
        submitted_by: user.id,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Error submitting place:", error);
      return { error: "Failed to submit place" };
    }

    return { success: true, submissionId: data.id };
  } catch (error) {
    console.error("Error in submitPlace:", error);
    return { error: "An unexpected error occurred" };
  }
}

// ============================================
// GET USER SUBMISSIONS
// ============================================

/**
 * Get the current user's place submissions
 */
export async function getMyPlaceSubmissions() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { submissions: [] };
    }

    const { data, error } = await supabase
      .from("place_submissions")
      .select("*")
      .eq("submitted_by", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching submissions:", error);
      return { submissions: [] };
    }

    return { submissions: data || [] };
  } catch (error) {
    console.error("Error in getMyPlaceSubmissions:", error);
    return { submissions: [] };
  }
}

// ============================================
// ADMIN: GET PENDING SUBMISSIONS
// ============================================

/**
 * Get all pending place submissions (admin only)
 */
export async function getPendingPlaceSubmissions() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { submissions: [], error: "Not authenticated" };
    }

    // Check if admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return { submissions: [], error: "Not authorized" };
    }

    const { data, error } = await supabase
      .from("place_submissions")
      .select(`
        *,
        submitter:profiles!place_submissions_submitted_by_fkey(username, display_name)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching pending submissions:", error);
      return { submissions: [], error: "Failed to fetch submissions" };
    }

    return { submissions: data || [] };
  } catch (error) {
    console.error("Error in getPendingPlaceSubmissions:", error);
    return { submissions: [], error: "An unexpected error occurred" };
  }
}

// ============================================
// ADMIN: APPROVE SUBMISSION
// ============================================

/**
 * Approve a place submission (admin only)
 */
export async function approvePlaceSubmission(submissionId: string, notes?: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Check if admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return { error: "Not authorized" };
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
      admin_notes: notes || null,
    });

    if (error) {
      console.error("Error approving submission:", error);
      return { error: "Failed to approve submission" };
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
    console.error("Error in approvePlaceSubmission:", error);
    return { error: "An unexpected error occurred" };
  }
}

// ============================================
// ADMIN: REJECT SUBMISSION
// ============================================

/**
 * Reject a place submission (admin only)
 */
export async function rejectPlaceSubmission(submissionId: string, notes?: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Check if admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return { error: "Not authorized" };
    }

    // Fetch submission for audit log
    const { data: submission } = await supabase
      .from("place_submissions")
      .select("name, place_type, city, country, submitted_by")
      .eq("id", submissionId)
      .single();

    // Call the database function to reject
    const { error } = await supabase.rpc("reject_place_submission", {
      submission_id: submissionId,
      admin_notes: notes || null,
    });

    if (error) {
      console.error("Error rejecting submission:", error);
      return { error: "Failed to reject submission" };
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
    console.error("Error in rejectPlaceSubmission:", error);
    return { error: "An unexpected error occurred" };
  }
}

