"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import {
  createClubSchema,
  setCurrentBookSchema,
  updateClubSchema,
  clubIdSchema,
} from "@/lib/validation/club";
import type { ClubVisibility } from "@/types/database";
import { logError, reportError } from "@/lib/utils/log";
interface CreateClubInput {
  name: string;
  description?: string;
  visibility?: ClubVisibility;
}

export async function createClub(
  input: CreateClubInput
): Promise<{ success: boolean; slug?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Rate limit: 10 club creations per minute per user
  const { allowed } = await checkRateLimit(`club:create:${user.id}`, 10, 60000);
  if (!allowed) {
    return { success: false, error: "Too many requests. Please wait a moment." };
  }

  // Validate input with Zod
  const validationResult = createClubSchema.safeParse(input);
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0]?.message || "Invalid input",
    };
  }

  const data = validationResult.data;

  // Generate slug
  const { data: slugData, error: slugError } = await supabase.rpc(
    "generate_club_slug",
    { club_name: data.name }
  );

  if (slugError) {
    logError("[createClub] Slug error", slugError);
    return { success: false, error: "Failed to generate slug" };
  }

  const slug = slugData as string;

  // Create club
  const { data: club, error: clubError } = await supabase
    .from("book_clubs")
    .insert({
      name: data.name,
      slug,
      description: data.description || null,
      visibility: data.visibility || "public",
      created_by: user.id,
    })
    .select("id, slug")
    .single();

  if (clubError) {
    reportError("[createClub] Club insert error", clubError);
    return { success: false, error: "Failed to create club. Please try again." };
  }

  // Add creator as admin member using SECURITY DEFINER function to bypass RLS recursion
  const { error: memberError } = await supabase.rpc("add_club_creator_as_admin", {
    p_club_id: club.id,
    p_user_id: user.id,
  });

  if (memberError) {
    logError("[createClub] Member insert error", memberError);
    // Rollback: delete the club since we couldn't add the creator as admin
    await supabase.from("book_clubs").delete().eq("id", club.id);
    return { success: false, error: "Failed to add you as club admin. Please try again." };
  }

  revalidatePath("/clubs");
  return { success: true, slug: club.slug };
}

export async function joinClub(
  clubId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Rate limit: 20 join/leave actions per minute per user
  const { allowed } = await checkRateLimit(`club:member:${user.id}`, 20, 60000);
  if (!allowed) {
    return { success: false, error: "Too many requests. Please wait a moment." };
  }

  // Validate input with Zod
  const validationResult = clubIdSchema.safeParse(clubId);
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0]?.message || "Invalid input",
    };
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("book_club_members")
    .select("club_id")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return { success: false, error: "Already a member" };
  }

  // Join club
  const { error } = await supabase.from("book_club_members").insert({
    club_id: clubId,
    user_id: user.id,
    role: "member",
  });

  if (error) {
    logError("Error joining club", error);
    return { success: false, error: "Failed to join club" };
  }

  revalidatePath("/clubs");
  return { success: true };
}

export async function leaveClub(
  clubId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Rate limit: 20 join/leave actions per minute per user
  const { allowed } = await checkRateLimit(`club:member:${user.id}`, 20, 60000);
  if (!allowed) {
    return { success: false, error: "Too many requests. Please wait a moment." };
  }

  // Validate input with Zod
  const validationResult = clubIdSchema.safeParse(clubId);
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0]?.message || "Invalid input",
    };
  }

  // Check if user is the only admin
  const { data: membership } = await supabase
    .from("book_club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return { success: false, error: "Not a member of this club" };
  }

  if (membership.role === "admin") {
    // Count other admins
    const { count } = await supabase
      .from("book_club_members")
      .select("*", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("role", "admin")
      .neq("user_id", user.id);

    if ((count || 0) === 0) {
      return {
        success: false,
        error: "Cannot leave: you are the only admin. Transfer ownership or delete the club.",
      };
    }
  }

  // Leave club
  const { error } = await supabase
    .from("book_club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", user.id);

  if (error) {
    logError("Error leaving club", error);
    return { success: false, error: "Failed to leave club" };
  }

  revalidatePath("/clubs");
  return { success: true };
}

export async function setCurrentBook(
  clubId: string,
  bookId: string,
  clubSlug?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Rate limit: 20 club updates per minute per user
  const { allowed } = await checkRateLimit(`club:update:${user.id}`, 20, 60000);
  if (!allowed) {
    return { success: false, error: "Too many requests. Please wait a moment." };
  }

  // Validate input with Zod
  const validationResult = setCurrentBookSchema.safeParse({
    clubId,
    bookId,
    clubSlug,
  });
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0]?.message || "Invalid input",
    };
  }

  // Check if user is admin
  const { data: membership } = await supabase
    .from("book_club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .single();

  if (!membership || membership.role !== "admin") {
    return { success: false, error: "Only admins can set the current book" };
  }

  // Mark any existing current book as completed
  await supabase
    .from("book_club_reads")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("club_id", clubId)
    .eq("status", "current");

  // Add new current book (or update if it was previously read)
  const { error } = await supabase
    .from("book_club_reads")
    .upsert(
      {
        club_id: clubId,
        book_id: bookId,
        status: "current",
        started_at: new Date().toISOString(),
        completed_at: null,
      },
      { onConflict: "club_id,book_id" }
    );

  if (error) {
    logError("Error setting current book", error);
    return { success: false, error: "Failed to set current book" };
  }

  revalidatePath("/clubs");
  if (clubSlug) {
    revalidatePath(`/clubs/${clubSlug}`);
  }
  return { success: true };
}

export async function updateClub(
  clubId: string,
  updates: { name?: string; description?: string; visibility?: ClubVisibility }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Rate limit: 20 club updates per minute per user
  const { allowed } = await checkRateLimit(`club:update:${user.id}`, 20, 60000);
  if (!allowed) {
    return { success: false, error: "Too many requests. Please wait a moment." };
  }

  // Validate input with Zod
  const validationResult = updateClubSchema.safeParse({ clubId, ...updates });
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0]?.message || "Invalid input",
    };
  }

  const data = validationResult.data;

  // Check if user is admin
  const { data: membership } = await supabase
    .from("book_club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .single();

  if (!membership || membership.role !== "admin") {
    return { success: false, error: "Only admins can update the club" };
  }

  const updateData: Record<string, unknown> = {};
  if (data.name) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description || null;
  if (data.visibility) updateData.visibility = data.visibility;

  const { error } = await supabase
    .from("book_clubs")
    .update(updateData)
    .eq("id", clubId);

  if (error) {
    logError("Error updating club", error);
    return { success: false, error: "Failed to update club" };
  }

  revalidatePath("/clubs");
  return { success: true };
}

export async function deleteClub(
  clubId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Rate limit: 20 club deletes per minute per user
  const { allowed } = await checkRateLimit(`club:delete:${user.id}`, 20, 60000);
  if (!allowed) {
    return { success: false, error: "Too many requests. Please wait a moment." };
  }

  // Validate input with Zod
  const validationResult = clubIdSchema.safeParse(clubId);
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0]?.message || "Invalid input",
    };
  }

  // Check if user is admin
  const { data: membership } = await supabase
    .from("book_club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .single();

  if (!membership || membership.role !== "admin") {
    return { success: false, error: "Only admins can delete the club" };
  }

  const { error } = await supabase.from("book_clubs").delete().eq("id", clubId);

  if (error) {
    logError("Error deleting club", error);
    return { success: false, error: "Failed to delete club" };
  }

  revalidatePath("/clubs");
  return { success: true };
}
