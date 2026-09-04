// The caller's reading challenges with computed progress.
// Read-only; moved out of the "use server" file in Phase 2 Task 22 so it is a
// plain server function instead of a public POST endpoint.

import { createClient, getUser } from "@/lib/supabase/server";
import type { ChallengeWithProgress } from "@/types/database";
import { logError, reportError } from "@/lib/utils/log";

export async function getChallenges(): Promise<{
  data: ChallengeWithProgress[] | null;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await getUser();
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
