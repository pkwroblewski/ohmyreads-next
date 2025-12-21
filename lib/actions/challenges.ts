"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  ChallengeType,
  ReadingChallenge,
  ChallengeWithProgress,
} from "@/types/database";

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

    // Validation
    if (!input.name.trim()) {
      return { error: "Challenge name is required" };
    }

    if (input.target_value < 1 || input.target_value > 10000) {
      return { error: "Target must be between 1 and 10,000" };
    }

    if (new Date(input.end_date) <= new Date(input.start_date)) {
      return { error: "End date must be after start date" };
    }

    if (input.challenge_type === "genre_books" && !input.genre) {
      return { error: "Genre is required for genre-based challenges" };
    }

    const { data, error } = await supabase
      .from("reading_challenges")
      .insert({
        user_id: user.id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        challenge_type: input.challenge_type,
        target_value: input.target_value,
        genre: input.genre || null,
        start_date: input.start_date,
        end_date: input.end_date,
        current_value: 0,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating challenge:", error);
      return { error: error.message };
    }

    revalidatePath("/challenges");
    revalidatePath("/dashboard");

    return { success: true, data };
  } catch (error) {
    console.error("Unexpected error in createChallenge:", error);
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

    const { error } = await supabase
      .from("reading_challenges")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", challengeId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating challenge:", error);
      return { error: error.message };
    }

    revalidatePath("/challenges");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Unexpected error in updateChallenge:", error);
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

    const { error } = await supabase
      .from("reading_challenges")
      .delete()
      .eq("id", challengeId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting challenge:", error);
      return { error: error.message };
    }

    revalidatePath("/challenges");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Unexpected error in deleteChallenge:", error);
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
      console.error("Error fetching challenges:", challengesError);
      return { data: null, error: challengesError.message };
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
    console.error("Unexpected error in getChallenges:", error);
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

    // Update challenges that need status changes
    for (const challenge of challengesWithProgress) {
      if (
        challenge.status !== (challenge as ReadingChallenge).status ||
        challenge.current_value !==
          (challenge as ReadingChallenge).current_value
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
    console.error("Unexpected error in syncChallengeProgress:", error);
    return { error: "An unexpected error occurred" };
  }
}
