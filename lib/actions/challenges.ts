"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import {
  createChallengeSchema,
  updateChallengeSchema,
  challengeIdSchema,
} from "@/lib/validation/challenge";
import type {
  ChallengeType,
  ReadingChallenge,
  ChallengeWithProgress,
} from "@/types/database";
import { logError, reportError } from "@/lib/utils/log";
interface CreateChallengeInput {
  name: string;
  description?: string;
  challenge_type: ChallengeType;
  target_value: number;
  genre?: string;
  start_date: string;
  end_date: string;
}

export async function createChallenge(input: CreateChallengeInput) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Rate limit: 10 challenge creations per minute per user
    const { allowed } = await checkRateLimit(`challenge:${user.id}`, 10, 60000);
    if (!allowed) {
      return { error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = createChallengeSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }
    const validated = validationResult.data;

    if (new Date(validated.end_date) <= new Date(validated.start_date)) {
      return { error: "End date must be after start date" };
    }

    if (validated.challenge_type === "genre_books" && !validated.genre) {
      return { error: "Genre is required for genre-based challenges" };
    }

    const { data, error } = await supabase
      .from("reading_challenges")
      .insert({
        user_id: user.id,
        name: validated.name,
        description: validated.description || null,
        challenge_type: validated.challenge_type,
        target_value: validated.target_value,
        genre: validated.genre || null,
        start_date: validated.start_date,
        end_date: validated.end_date,
        current_value: 0,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      return { error: reportError("Error creating challenge", error) };
    }

    revalidatePath("/challenges");
    revalidatePath("/dashboard");

    return { success: true, data };
  } catch (error) {
    logError("Unexpected error in createChallenge", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function updateChallenge(
  challengeId: string,
  updates: Partial<Pick<ReadingChallenge, "name" | "description" | "status">>
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Rate limit: 10 challenge mutations per minute per user
    const { allowed } = await checkRateLimit(`challenge:${user.id}`, 10, 60000);
    if (!allowed) {
      return { error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod (also strips unknown keys from the spread)
    const validationResult = updateChallengeSchema.safeParse({
      challengeId,
      updates,
    });
    if (!validationResult.success) {
      return {
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const { error } = await supabase
      .from("reading_challenges")
      .update({
        ...validationResult.data.updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", challengeId)
      .eq("user_id", user.id);

    if (error) {
      return { error: reportError("Error updating challenge", error) };
    }

    revalidatePath("/challenges");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    logError("Unexpected error in updateChallenge", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function deleteChallenge(challengeId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Rate limit: 10 challenge mutations per minute per user
    const { allowed } = await checkRateLimit(`challenge:${user.id}`, 10, 60000);
    if (!allowed) {
      return { error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = challengeIdSchema.safeParse(challengeId);
    if (!validationResult.success) {
      return {
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const { error } = await supabase
      .from("reading_challenges")
      .delete()
      .eq("id", challengeId)
      .eq("user_id", user.id);

    if (error) {
      return { error: reportError("Error deleting challenge", error) };
    }

    revalidatePath("/challenges");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    logError("Unexpected error in deleteChallenge", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function abandonChallenge(challengeId: string) {
  return updateChallenge(challengeId, { status: "abandoned" });
}

export async function getChallenges(): Promise<{
  data: ChallengeWithProgress[] | null;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: "Not authenticated" };
    }

    // Get all challenges
    const { data: challenges, error: challengesError } = await supabase
      .from("reading_challenges")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (challengesError) {
      return { data: null, error: reportError("Error fetching challenges", challengesError) };
    }

    if (!challenges || challenges.length === 0) {
      return { data: [], error: null };
    }

    // Get user's reading data for progress calculation
    const { data: userBooks } = await supabase
      .from("user_books")
      .select(
        `
        id,
        status,
        finished_at,
        book:books(
          page_count,
          genres
        )
      `
      )
      .eq("user_id", user.id)
      .eq("status", "read");

    const today = new Date();

    // Calculate progress for each challenge
    const challengesWithProgress: ChallengeWithProgress[] = challenges.map(
      (challenge) => {
        const startDate = new Date(challenge.start_date);
        const endDate = new Date(challenge.end_date);
        const daysRemaining = Math.max(
          0,
          Math.ceil(
            (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          )
        );
        const totalDays = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const daysElapsed = Math.max(0, totalDays - daysRemaining);

        // Calculate current value based on challenge type
        let currentValue = 0;

        if (userBooks) {
          const booksInPeriod = userBooks.filter((ub) => {
            if (!ub.finished_at) return false;
            const finishedDate = new Date(ub.finished_at);
            return finishedDate >= startDate && finishedDate <= endDate;
          });

          switch (challenge.challenge_type) {
            case "books_count":
              currentValue = booksInPeriod.length;
              break;

            case "pages_count":
              currentValue = booksInPeriod.reduce((sum, ub) => {
                const book = Array.isArray(ub.book) ? ub.book[0] : ub.book;
                return sum + (book?.page_count || 0);
              }, 0);
              break;

            case "genre_books":
              currentValue = booksInPeriod.filter((ub) => {
                const book = Array.isArray(ub.book) ? ub.book[0] : ub.book;
                return book?.genres?.some(
                  (g: string) =>
                    g.toLowerCase() === challenge.genre?.toLowerCase()
                );
              }).length;
              break;
          }
        }

        const progressPercentage = Math.min(
          100,
          Math.round((currentValue / challenge.target_value) * 100)
        );

        // Calculate if on track (linear progress)
        const expectedProgress =
          totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
        const isOnTrack = progressPercentage >= expectedProgress;

        // Check if challenge should be marked as completed or failed
        let status = challenge.status;
        if (
          status === "active" &&
          currentValue >= challenge.target_value
        ) {
          status = "completed";
        } else if (status === "active" && today > endDate) {
          status = "failed";
        }

        return {
          ...challenge,
          current_value: currentValue,
          status,
          progress_percentage: progressPercentage,
          days_remaining: daysRemaining,
          is_on_track: isOnTrack,
        } as ChallengeWithProgress;
      }
    );

    return { data: challengesWithProgress, error: null };
  } catch (error) {
    logError("Unexpected error in getChallenges", error);
    return { data: null, error: "An unexpected error occurred" };
  }
}

// Sync challenge progress (called when books are marked as read)
export async function syncChallengeProgress() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    const { data: challengesWithProgress } = await getChallenges();

    if (!challengesWithProgress) return { success: true };

    // getChallenges overlays COMPUTED current_value/status on each row, so
    // the stored values must be fetched separately to detect drift
    const { data: stored } = await supabase
      .from("reading_challenges")
      .select("id, current_value, status")
      .eq("user_id", user.id);

    const storedById = new Map((stored ?? []).map((c) => [c.id, c]));

    // Update challenges whose stored values drifted from computed progress
    for (const challenge of challengesWithProgress) {
      const db = storedById.get(challenge.id);
      if (
        db &&
        (challenge.status !== db.status ||
          challenge.current_value !== db.current_value)
      ) {
        await supabase
          .from("reading_challenges")
          .update({
            current_value: challenge.current_value,
            status: challenge.status,
            completed_at:
              challenge.status === "completed"
                ? new Date().toISOString()
                : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", challenge.id)
          .eq("user_id", user.id);
      }
    }

    revalidatePath("/challenges");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    logError("Unexpected error in syncChallengeProgress", error);
    return { error: "An unexpected error occurred" };
  }
}
