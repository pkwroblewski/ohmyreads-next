"use server";

import { revalidatePath } from "next/cache";
import { CACHE_TAGS, invalidateTags } from "@/lib/cache/tags";
import { requireUser } from "@/lib/auth/require-user";
import { syncUserBadges } from "@/lib/actions/badges";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import {
  createCheckinSchema,
  placeIdSchema,
} from "@/lib/validation/checkin";
import type { CheckinWithRelations } from "@/types/database";
import { logError } from "@/lib/utils/log";
import type { ActionResult } from "@/types/app";
import { createClient } from "@/lib/supabase/server";

// ============================================
// CONSTANTS
// ============================================

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

// ============================================
// TYPES
// ============================================

interface CreateCheckinInput {
  placeId: string;
  bookId?: string | null;
  note?: string | null;
}

type CreateCheckinResult = ActionResult<{
  checkinId: string;
  newBadges: Array<{ id: string; name: string; icon: string }>;
}>;

// ============================================
// CREATE CHECK-IN
// ============================================

/**
 * Create a check-in at a place
 * Rate limited: 1 check-in per place per 4 hours
 */
export async function createCheckin(input: CreateCheckinInput): Promise<CreateCheckinResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: "You must be logged in to check in" };
    }
    const { supabase, user } = auth;

    // Validate input with Zod (before the rate limit — its key embeds placeId)
    const validationResult = createCheckinSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }
    input = validationResult.data;

    // Rate limit: 1 check-in per place per 4 hours
    const rateLimitKey = `checkin:${user.id}:${input.placeId}`;
    const { allowed, resetIn } = await checkRateLimit(rateLimitKey, 1, FOUR_HOURS_MS);

    if (!allowed) {
      const hoursRemaining = Math.ceil(resetIn / (60 * 60 * 1000));
      return {
        success: false,
        error: `You've already checked in here recently. Try again in ${hoursRemaining} hour${hoursRemaining !== 1 ? "s" : ""}.`,
      };
    }

    // Validate place exists
    const { data: place, error: placeError } = await supabase
      .from("places")
      .select("id")
      .eq("id", input.placeId)
      .single();

    if (placeError || !place) {
      return { success: false, error: "Place not found" };
    }

    // Validate book if provided
    if (input.bookId) {
      const { data: book, error: bookError } = await supabase
        .from("books")
        .select("id")
        .eq("id", input.bookId)
        .single();

      if (bookError || !book) {
        return { success: false, error: "Book not found" };
      }
    }

    // Create the check-in
    const { data: checkin, error } = await supabase
      .from("place_checkins")
      .insert({
        place_id: input.placeId,
        user_id: user.id,
        book_id: input.bookId || null,
        note: input.note?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      logError("Error creating check-in", error);
      return { success: false, error: "Failed to create check-in" };
    }

    // Check for new badges (after stats are updated by trigger). Awarded via
    // the shared service-role path: RLS blocks user_badges inserts since 064.
    const badgeSync = await syncUserBadges();
    const newBadges = badgeSync.success ? badgeSync.newBadges : [];

    // A trigger writes the check-in into activity_feed, staling the cached feed.
    invalidateTags(CACHE_TAGS.activity);
    revalidatePath("/community");
    revalidatePath("/community/map");

    return {
      success: true,
      checkinId: checkin.id,
      newBadges,
    };
  } catch (error) {
    logError("Error in createCheckin", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================
// GET PLACE CHECK-INS
// ============================================

/**
 * Get check-ins for a specific place
 */
export async function getPlaceCheckins(
  placeId: string,
  limit = 20
): Promise<{ checkins: CheckinWithRelations[] }> {
  try {
    // Read-only: validate id param only
    if (!placeIdSchema.safeParse(placeId).success) {
      return { checkins: [] };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("place_checkins")
      .select(
        `
        id,
        place_id,
        user_id,
        book_id,
        note,
        created_at,
        user:profiles!place_checkins_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        ),
        book:books!place_checkins_book_id_fkey (
          id,
          title,
          author,
          slug,
          cover_url
        ),
        place:places!place_checkins_place_id_fkey (
          id,
          name,
          place_type
        )
      `
      )
      .eq("place_id", placeId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logError("Error fetching check-ins", error);
      return { checkins: [] };
    }

    // Transform data to match CheckinWithRelations type
    // Supabase returns relations as arrays, so we need to handle that
    const checkins: CheckinWithRelations[] = (data || []).map((item) => {
      const user = Array.isArray(item.user) ? item.user[0] : item.user;
      const book = Array.isArray(item.book) ? item.book[0] : item.book;
      const place = Array.isArray(item.place) ? item.place[0] : item.place;

      return {
        id: item.id,
        place_id: item.place_id,
        user_id: item.user_id,
        book_id: item.book_id,
        note: item.note,
        created_at: item.created_at,
        user: user as CheckinWithRelations["user"],
        book: book as CheckinWithRelations["book"],
        place: place as CheckinWithRelations["place"],
      };
    });

    return { checkins };
  } catch (error) {
    logError("Error in getPlaceCheckins", error);
    return { checkins: [] };
  }
}
