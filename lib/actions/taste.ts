"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { logger, reportError } from "@/lib/utils/log";
import {
  updateTasteProfileSchema,
  onboardingTasteProfileSchema,
  type UpdateTasteProfileInput,
  type OnboardingTasteProfileInput,
} from "@/lib/validation/taste";
import type { ActionResult } from "@/types/app";

/**
 * Update user's taste profile (preferences only)
 */
export async function updateTasteProfile(input: UpdateTasteProfileInput): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: "You must be logged in to update your taste profile" };
    }
    const { supabase, user } = auth;

    // Rate limiting: 10 updates per minute
    const { allowed } = await checkRateLimit(`taste:${user.id}`, 10, 60000);
    if (!allowed) {
      logger.warn("Rate limit exceeded for taste profile update", {
        userId: user.id,
        action: "updateTasteProfile",
      });
      return { success: false, error: "Too many updates. Please wait a moment and try again." };
    }

    // Validate input
    const validationResult = updateTasteProfileSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
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
      return {
        success: false,
        error: reportError("Error updating taste profile", error, {
          userId: user.id,
        }),
      };
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
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Complete taste onboarding (includes seed books)
 */
export async function completeTasteOnboarding(input: OnboardingTasteProfileInput): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: "You must be logged in to complete onboarding" };
    }
    const { supabase, user } = auth;

    // Rate limiting: 5 onboarding completions per hour (to prevent abuse)
    const { allowed } = await checkRateLimit(`taste-onboard:${user.id}`, 5, 3600000);
    if (!allowed) {
      logger.warn("Rate limit exceeded for taste onboarding", {
        userId: user.id,
        action: "completeTasteOnboarding",
      });
      return { success: false, error: "Too many attempts. Please try again later." };
    }

    // Validate input
    const validationResult = onboardingTasteProfileSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
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
      return {
        success: false,
        error: reportError("Error completing taste onboarding", error, {
          userId: user.id,
        }),
      };
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
    return { success: false, error: "An unexpected error occurred" };
  }
}

