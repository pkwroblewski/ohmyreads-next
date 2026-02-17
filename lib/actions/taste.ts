"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { logger } from "@/lib/utils/log";
import {
  updateTasteProfileSchema,
  onboardingTasteProfileSchema,
  type UpdateTasteProfileInput,
  type OnboardingTasteProfileInput,
} from "@/lib/validation/taste";

/**
 * Update user's taste profile (preferences only)
 */
export async function updateTasteProfile(input: UpdateTasteProfileInput) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "You must be logged in to update your taste profile" };
    }

    // Rate limiting: 10 updates per minute
    const { allowed } = await checkRateLimit(`taste:${user.id}`, 10, 60000);
    if (!allowed) {
      logger.warn("Rate limit exceeded for taste profile update", {
        userId: user.id,
        action: "updateTasteProfile",
      });
      return { error: "Too many updates. Please wait a moment and try again." };
    }

    // Validate input
    const validationResult = updateTasteProfileSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const data = validationResult.data;

    // Upsert taste profile
    const { error } = await supabase.from("user_taste_profiles").upsert(
      {
        user_id: user.id,
        preferred_genres: data.preferredGenres,
        preferred_vibes: data.preferredVibes,
        preferred_pace: data.preferredPace,
        preferred_length: data.preferredLength,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      logger.error("Error updating taste profile", {
        userId: user.id,
        error: error.message,
      });
      return { error: error.message };
    }

    logger.info("Taste profile updated", {
      userId: user.id,
      genreCount: data.preferredGenres.length,
      vibeCount: data.preferredVibes.length,
    });

    // Revalidate relevant pages
    revalidatePath("/settings");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    logger.error("Unexpected error in updateTasteProfile", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Complete taste onboarding (includes seed books)
 */
export async function completeTasteOnboarding(input: OnboardingTasteProfileInput) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "You must be logged in to complete onboarding" };
    }

    // Rate limiting: 5 onboarding completions per hour (to prevent abuse)
    const { allowed } = await checkRateLimit(`taste-onboard:${user.id}`, 5, 3600000);
    if (!allowed) {
      logger.warn("Rate limit exceeded for taste onboarding", {
        userId: user.id,
        action: "completeTasteOnboarding",
      });
      return { error: "Too many attempts. Please try again later." };
    }

    // Validate input
    const validationResult = onboardingTasteProfileSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const data = validationResult.data;

    // Upsert taste profile with onboarding_completed flag
    const { error } = await supabase.from("user_taste_profiles").upsert(
      {
        user_id: user.id,
        preferred_genres: data.preferredGenres,
        preferred_vibes: data.preferredVibes,
        preferred_pace: data.preferredPace,
        preferred_length: data.preferredLength,
        seed_book_ids: data.seedBookIds,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      logger.error("Error completing taste onboarding", {
        userId: user.id,
        error: error.message,
      });
      return { error: error.message };
    }

    logger.info("Taste onboarding completed", {
      userId: user.id,
      genreCount: data.preferredGenres.length,
      vibeCount: data.preferredVibes.length,
      seedBookCount: data.seedBookIds.length,
    });

    // Revalidate relevant pages
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/onboarding/taste");

    return { success: true };
  } catch (error) {
    logger.error("Unexpected error in completeTasteOnboarding", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Get current user's taste profile
 * Note: This is non-critical - if it fails, we just return null
 * and the app continues to work without personalization
 */
export async function getTasteProfile() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { profile: null };
    }

    const { data: profile, error } = await supabase
      .from("user_taste_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Any error (table doesn't exist, no rows, etc.) - just return null
    // This is non-critical functionality
    if (error) {
      // Only log in development for debugging, and only for unexpected errors
      if (process.env.NODE_ENV === "development") {
        // Common expected errors - don't log these
        const isExpectedError = 
          error.code === "PGRST116" || // No rows found
          error.code === "42P01" ||    // Table doesn't exist
          String(error.message || "").includes("does not exist") ||
          String(error.code || "").includes("PGRST");
        
        if (!isExpectedError) {
          console.log("[getTasteProfile] Non-critical error:", error.code, error.message);
        }
      }
      return { profile: null };
    }

    return { profile: profile || null };
  } catch {
    // Silently fail - taste profile is optional
    return { profile: null };
  }
}

