import { createClient } from "@/lib/supabase/server";
import type { Profile, UserBook, Review, SocialLink } from "@/types/database";

export async function getProfileByUsername(
  username: string
): Promise<Profile | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error in getProfileByUsername:", error);
    return null;
  }
}

export async function getUserStats(userId: string) {
  try {
    const supabase = await createClient();

    // Get counts in parallel
    const [booksResult, reviewsResult] = await Promise.all([
      supabase
        .from("user_books")
        .select("status")
        .eq("user_id", userId),
      supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    // Count books by status
    const books = booksResult.data || [];
    const booksRead = books.filter((b) => b.status === "read").length;
    const booksReading = books.filter((b) => b.status === "reading").length;
    const booksWantToRead = books.filter(
      (b) => b.status === "want_to_read"
    ).length;

    return {
      booksRead,
      booksReading,
      booksWantToRead,
      totalBooks: books.length,
      reviewsCount: reviewsResult.count || 0,
    };
  } catch (error) {
    console.error("Error in getUserStats:", error);
    return {
      booksRead: 0,
      booksReading: 0,
      booksWantToRead: 0,
      totalBooks: 0,
      reviewsCount: 0,
    };
  }
}

interface UserBookWithBook extends UserBook {
  book: {
    id: string;
    title: string;
    author: string;
    slug: string;
    cover_url: string | null;
  } | null;
}

export async function getUserBooks(
  userId: string,
  status?: string,
  limit = 20
): Promise<UserBookWithBook[]> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("user_books")
      .select(
        `
        *,
        book:books(id, title, author, slug, cover_url)
      `
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching user books:", error);
      return [];
    }

    return (data as UserBookWithBook[]) || [];
  } catch (error) {
    console.error("Error in getUserBooks:", error);
    return [];
  }
}

interface ReviewWithBook extends Review {
  book: {
    id: string;
    title: string;
    slug: string;
    cover_url: string | null;
    author: string;
  } | null;
}

export async function getUserReviews(
  userId: string,
  limit = 10
): Promise<ReviewWithBook[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reviews")
      .select(
        `
        *,
        book:books(id, title, slug, cover_url, author)
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching user reviews:", error);
      return [];
    }

    return (data as ReviewWithBook[]) || [];
  } catch (error) {
    console.error("Error in getUserReviews:", error);
    return [];
  }
}

export async function getSocialLinks(userId: string): Promise<SocialLink[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("social_links")
      .select("*")
      .eq("user_id", userId)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching social links:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error in getSocialLinks:", error);
    return [];
  }
}

