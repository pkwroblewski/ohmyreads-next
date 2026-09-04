"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import {
  createChallengeSchema,
  updateChallengeSchema,
  challengeIdSchema,
} from "@/lib/validation/challenge";
import type {
  ChallengeType,
  ReadingChallenge,
} from "@/types/database";
import { logError, reportError } from "@/lib/utils/log";
import { getChallenges } from "@/lib/queries/challenges";
import type { ActionResult } from "@/types/app";
interface CreateChallengeInput {
  name: string;
  description?: string;
  challenge_type: ChallengeType;
  target_value: number;
  genre?: string;
  start_date: string;
  end_date: string;
}

export async function createChallenge(input: CreateChallengeInput): Promise<ActionResult<{ data: ReadingChallenge }>> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Rate limit: 10 challenge creations per minute per user
    const { allowed } = await checkRateLimit(`challenge:${user.id}`, 10, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = createChallengeSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }
    const validated = validationResult.data;

    if (new Date(validated.end_date) <= new Date(validated.start_date)) {
      return { success: false, error: "End date must be after start date" };
    }

    if (validated.challenge_type === "genre_books" && !validated.genre) {
      return { success: false, error: "Genre is required for genre-based challenges" };
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
      return { success: false, error: reportError("Error creating challenge", error) };
    }

    revalidatePath("/challenges");
    revalidatePath("/dashboard");

    return { success: true, data };
  } catch (error) {
    logError("Unexpected error in createChallenge", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

async function updateChallenge(
  challengeId: string,
  updates: Partial<Pick<ReadingChallenge, "name" | "description" | "status">>
): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Rate limit: 10 challenge mutations per minute per user
    const { allowed } = await checkRateLimit(`challenge:${user.id}`, 10, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod (also strips unknown keys from the spread)
    const validationResult = updateChallengeSchema.safeParse({
      challengeId,
      updates,
    });
    if (!validationResult.success) {
      return {
        success: false,
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
      return { success: false, error: reportError("Error updating challenge", error) };
    }

    revalidatePath("/challenges");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    logError("Unexpected error in updateChallenge", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function deleteChallenge(challengeId: string): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Rate limit: 10 challenge mutations per minute per user
    const { allowed } = await checkRateLimit(`challenge:${user.id}`, 10, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = challengeIdSchema.safeParse(challengeId);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const { error } = await supabase
      .from("reading_challenges")
      .delete()
      .eq("id", challengeId)
      .eq("user_id", user.id);

    if (error) {
      return { success: false, error: reportError("Error deleting challenge", error) };
    }

    revalidatePath("/challenges");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    logError("Unexpected error in deleteChallenge", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function abandonChallenge(challengeId: string) {
  return updateChallenge(challengeId, { status: "abandoned" });
}

// Sync challenge progress (called when books are marked as read)
export async function syncChallengeProgress(): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

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
    return { success: false, error: "An unexpected error occurred" };
  }
}
