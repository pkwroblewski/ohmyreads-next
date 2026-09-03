import { createClient, getUser } from "@/lib/supabase/server";
import { logError } from "@/lib/utils/log";
import type {
  BookClubWithDetails,
  BookClubMemberWithProfile,
  BookClubReadWithBook,
} from "@/types/database";

interface GetClubsOptions {
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * Get all public clubs with pagination and search
 */
export async function getClubs(options: GetClubsOptions = {}): Promise<{
  clubs: BookClubWithDetails[];
  total: number;
}> {
  const { page = 1, limit = 12, search } = options;
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await getUser();

  // Build query
  let query = supabase
    .from("book_clubs")
    .select(
      `
      *,
      creator:profiles!book_clubs_created_by_fkey(
        id, username, display_name, avatar_url
      )
    `,
      { count: "exact" }
    )
    .eq("visibility", "public")
    .order("member_count", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search && search.length >= 2) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data: clubs, count, error } = await query;

  if (error) {
    logError("Error fetching clubs", error);
    return { clubs: [], total: 0 };
  }

  if (!clubs || clubs.length === 0) {
    return { clubs: [], total: count || 0 };
  }

  // Get current reads for all clubs
  const clubIds = clubs.map((c) => c.id);
  const { data: currentReads } = await supabase
    .from("book_club_reads")
    .select(
      `
      *,
      book:books(id, title, author, slug, cover_url)
    `
    )
    .in("club_id", clubIds)
    .eq("status", "current");

  // Get user's memberships if logged in
  const membershipMap = new Map<string, string>();
  if (user) {
    const { data: memberships } = await supabase
      .from("book_club_members")
      .select("club_id, role")
      .in("club_id", clubIds)
      .eq("user_id", user.id);

    memberships?.forEach((m) => {
      membershipMap.set(m.club_id, m.role ?? "member");
    });
  }

  // Map current reads to clubs
  const readsMap = new Map<string, BookClubReadWithBook>();
  currentReads?.forEach((read) => {
    if (read.book && read.club_id) {
      readsMap.set(read.club_id, {
        ...read,
        book: Array.isArray(read.book) ? read.book[0] : read.book,
      } as BookClubReadWithBook);
    }
  });

  // Transform to BookClubWithDetails
  const clubsWithDetails: BookClubWithDetails[] = clubs.map(
    (club) =>
      ({
        ...club,
        creator: Array.isArray(club.creator) ? club.creator[0] : club.creator,
        current_read: readsMap.get(club.id) || null,
        is_member: membershipMap.has(club.id),
        user_role: membershipMap.get(club.id) || null,
      }) as BookClubWithDetails
  );

  return { clubs: clubsWithDetails, total: count || 0 };
}

/**
 * Get a single club by slug
 */
export async function getClubBySlug(slug: string): Promise<BookClubWithDetails | null> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await getUser();

  // Fetch club
  const { data: club, error } = await supabase
    .from("book_clubs")
    .select(
      `
      *,
      creator:profiles!book_clubs_created_by_fkey(
        id, username, display_name, avatar_url
      )
    `
    )
    .eq("slug", slug)
    .single();

  if (error || !club) {
    return null;
  }

  // Check if user can view private club
  if (club.visibility === "private" && user) {
    const { data: membership } = await supabase
      .from("book_club_members")
      .select("role")
      .eq("club_id", club.id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return null; // Can't view private club if not a member
    }
  } else if (club.visibility === "private") {
    return null; // Can't view private club if not logged in
  }

  // Get current read
  const { data: currentRead } = await supabase
    .from("book_club_reads")
    .select(
      `
      *,
      book:books(id, title, author, slug, cover_url)
    `
    )
    .eq("club_id", club.id)
    .eq("status", "current")
    .single();

  // Get user's membership
  let userRole = null;
  let isMember = false;
  if (user) {
    const { data: membership } = await supabase
      .from("book_club_members")
      .select("role")
      .eq("club_id", club.id)
      .eq("user_id", user.id)
      .single();

    if (membership) {
      isMember = true;
      userRole = membership.role;
    }
  }

  return {
    ...club,
    creator: Array.isArray(club.creator) ? club.creator[0] : club.creator,
    current_read: currentRead
      ? {
          ...currentRead,
          book: Array.isArray(currentRead.book) ? currentRead.book[0] : currentRead.book,
        }
      : null,
    is_member: isMember,
    user_role: userRole,
  } as BookClubWithDetails;
}

/**
 * Get members of a club
 */
export async function getClubMembers(
  clubId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ members: BookClubMemberWithProfile[]; total: number }> {
  const { limit = 20, offset = 0 } = options;

  const supabase = await createClient();

  const { data, count, error } = await supabase
    .from("book_club_members")
    .select(
      `
      *,
      profile:profiles(id, username, display_name, avatar_url)
    `,
      { count: "exact" }
    )
    .eq("club_id", clubId)
    .order("joined_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    logError("Error fetching members", error);
    return { members: [], total: 0 };
  }

  const members = (data || []).map((m) => ({
    ...m,
    profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
  })) as BookClubMemberWithProfile[];

  return { members, total: count || 0 };
}

/**
 * Get clubs the current user is a member of
 */
export async function getUserClubs(): Promise<BookClubWithDetails[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await getUser();

  if (!user) {
    return [];
  }

  // Get user's club memberships
  const { data: memberships } = await supabase
    .from("book_club_members")
    .select("club_id, role")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const clubIds = memberships.map((m) => m.club_id);
  const roleMap = new Map(memberships.map((m) => [m.club_id, m.role]));

  // Fetch clubs
  const { data: clubs } = await supabase
    .from("book_clubs")
    .select(
      `
      *,
      creator:profiles!book_clubs_created_by_fkey(
        id, username, display_name, avatar_url
      )
    `
    )
    .in("id", clubIds)
    .order("updated_at", { ascending: false });

  if (!clubs) {
    return [];
  }

  // Get current reads
  const { data: currentReads } = await supabase
    .from("book_club_reads")
    .select(
      `
      *,
      book:books(id, title, author, slug, cover_url)
    `
    )
    .in("club_id", clubIds)
    .eq("status", "current");

  const readsMap = new Map<string, BookClubReadWithBook>();
  currentReads?.forEach((read) => {
    if (read.book && read.club_id) {
      readsMap.set(read.club_id, {
        ...read,
        book: Array.isArray(read.book) ? read.book[0] : read.book,
      } as BookClubReadWithBook);
    }
  });

  return clubs.map((club) => ({
    ...club,
    creator: Array.isArray(club.creator) ? club.creator[0] : club.creator,
    current_read: readsMap.get(club.id) || null,
    is_member: true,
    user_role: roleMap.get(club.id) || null,
  })) as BookClubWithDetails[];
}

/**
 * Get past reads for a club
 */
export async function getClubPastReads(clubId: string): Promise<BookClubReadWithBook[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("book_club_reads")
    .select(
      `
      *,
      book:books(id, title, author, slug, cover_url)
    `
    )
    .eq("club_id", clubId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false });

  if (!data) {
    return [];
  }

  return data.map((read) => ({
    ...read,
    book: Array.isArray(read.book) ? read.book[0] : read.book,
  })) as BookClubReadWithBook[];
}
