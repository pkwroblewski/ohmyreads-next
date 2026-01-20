"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ClubVisibility } from "@/types/database";

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
  } = await supabase.auth.getUser();

  console.log("[createClub] User:", user?.id ?? "NOT AUTHENTICATED");

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Validate name
  if (!input.name || input.name.trim().length < 3) {
    return { success: false, error: "Club name must be at least 3 characters" };
  }

  if (input.name.length > 100) {
    return { success: false, error: "Club name must be less than 100 characters" };
  }

  // Generate slug
  const { data: slugData, error: slugError } = await supabase.rpc(
    "generate_club_slug",
    { club_name: input.name.trim() }
  );

  if (slugError) {
    console.error("[createClub] Slug error:", slugError);
    return { success: false, error: "Failed to generate slug" };
  }

  const slug = slugData as string;

  console.log("[createClub] Generated slug:", slug);

  // Create club
  const { data: club, error: clubError } = await supabase
    .from("book_clubs")
    .insert({
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      visibility: input.visibility || "public",
      created_by: user.id,
    })
    .select("id, slug")
    .single();

  if (clubError) {
    console.error("[createClub] Club insert error:", clubError);
    return { success: false, error: "Failed to create club: " + clubError.message };
  }

  // Add creator as admin member using SECURITY DEFINER function to bypass RLS recursion
  const { error: memberError } = await supabase.rpc("add_club_creator_as_admin", {
    p_club_id: club.id,
    p_user_id: user.id,
  });

  if (memberError) {
    console.error("[createClub] Member insert error:", memberError);
    // Club was created, so we'll still return success
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
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
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
    console.error("Error joining club:", error);
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
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
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
    console.error("Error leaving club:", error);
    return { success: false, error: "Failed to leave club" };
  }

  revalidatePath("/clubs");
  return { success: true };
}

export async function setCurrentBook(
  clubId: string,
  bookId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
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
    console.error("Error setting current book:", error);
    return { success: false, error: "Failed to set current book" };
  }

  revalidatePath("/clubs");
  return { success: true };
}

export async function updateClub(
  clubId: string,
  updates: { name?: string; description?: string; visibility?: ClubVisibility }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

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
  if (updates.name) updateData.name = updates.name.trim();
  if (updates.description !== undefined) updateData.description = updates.description?.trim() || null;
  if (updates.visibility) updateData.visibility = updates.visibility;

  const { error } = await supabase
    .from("book_clubs")
    .update(updateData)
    .eq("id", clubId);

  if (error) {
    console.error("Error updating club:", error);
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
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
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
    console.error("Error deleting club:", error);
    return { success: false, error: "Failed to delete club" };
  }

  revalidatePath("/clubs");
  return { success: true };
}
