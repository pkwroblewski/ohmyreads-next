import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExportData {
  profile: Record<string, unknown>;
  books: Array<Record<string, unknown>>;
  reviews: Array<Record<string, unknown>>;
  tasteProfile: Record<string, unknown> | null;
  challenges: Array<Record<string, unknown>>;
  badges: Array<Record<string, unknown>>;
  following: Array<Record<string, unknown>>;
  followers: Array<Record<string, unknown>>;
  readingGoals: Array<Record<string, unknown>>;
  exportedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 1 export per hour
    const { allowed, resetIn } = await checkRateLimit(
      `export:${user.id}`,
      1,
      3600000
    );

    if (!allowed) {
      const minutes = Math.ceil(resetIn / 60000);
      return NextResponse.json(
        {
          error: `You can only export your data once per hour. Please try again in ${minutes} minutes.`,
        },
        { status: 429 }
      );
    }

    const format = request.nextUrl.searchParams.get("format") || "json";

    if (format !== "json" && format !== "csv") {
      return NextResponse.json(
        { error: "Invalid format. Use 'json' or 'csv'" },
        { status: 400 }
      );
    }

    // Fetch all user data in parallel
    const [
      profileResult,
      booksResult,
      reviewsResult,
      tasteResult,
      challengesResult,
      badgesResult,
      followingResult,
      followersResult,
      goalsResult,
    ] = await Promise.all([
      // Profile
      supabase
        .from("profiles")
        .select("username, display_name, bio, website, created_at")
        .eq("id", user.id)
        .single(),

      // Books on shelves with book details
      supabase
        .from("user_books")
        .select(
          `
          status,
          rating,
          current_page,
          total_pages,
          progress_percentage,
          started_at,
          finished_at,
          created_at,
          book:books(title, author, isbn, genres, page_count, published_date)
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),

      // Reviews
      supabase
        .from("reviews")
        .select(
          `
          content,
          summary,
          liked,
          disliked,
          takeaway,
          vibe_tags,
          rating,
          is_spoiler,
          created_at,
          book:books(title, author)
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),

      // Taste profile
      supabase
        .from("user_taste_profiles")
        .select(
          "preferred_genres, preferred_vibes, preferred_pace, preferred_length"
        )
        .eq("user_id", user.id)
        .single(),

      // Challenges
      supabase
        .from("reading_challenges")
        .select(
          "name, description, challenge_type, target_value, genre, start_date, end_date, current_value, status, completed_at, created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),

      // Badges
      supabase
        .from("user_badges")
        .select("badge_id, unlocked_at")
        .eq("user_id", user.id)
        .order("unlocked_at", { ascending: false }),

      // Following
      supabase
        .from("follows")
        .select("created_at, following:profiles!follows_following_id_fkey(username, display_name)")
        .eq("follower_id", user.id),

      // Followers
      supabase
        .from("follows")
        .select("created_at, follower:profiles!follows_follower_id_fkey(username, display_name)")
        .eq("following_id", user.id),

      // Reading goals
      supabase
        .from("reading_goals")
        .select("year, target_books, created_at")
        .eq("user_id", user.id)
        .order("year", { ascending: false }),
    ]);

    const exportData: ExportData = {
      profile: profileResult.data || {},
      books: booksResult.data || [],
      reviews: reviewsResult.data || [],
      tasteProfile: tasteResult.data || null,
      challenges: challengesResult.data || [],
      badges: badgesResult.data || [],
      following: followingResult.data || [],
      followers: followersResult.data || [],
      readingGoals: goalsResult.data || [],
      exportedAt: new Date().toISOString(),
    };

    if (format === "json") {
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="ohmyreads-export-${new Date().toISOString().split("T")[0]}.json"`,
        },
      });
    }

    // CSV format - flatten data into rows
    const csvRows: string[] = [];

    // Add books section
    csvRows.push("=== BOOKS ===");
    csvRows.push(
      "Title,Author,Status,Rating,Progress,Started,Finished,Added"
    );
    for (const item of exportData.books) {
      const book = item.book as Record<string, unknown> | null;
      csvRows.push(
        [
          escapeCsv(book?.title as string),
          escapeCsv(book?.author as string),
          item.status,
          item.rating || "",
          `${item.progress_percentage || 0}%`,
          item.started_at || "",
          item.finished_at || "",
          item.created_at,
        ].join(",")
      );
    }

    csvRows.push("");
    csvRows.push("=== REVIEWS ===");
    csvRows.push("Book,Author,Rating,Summary,Content,Vibe Tags,Created");
    for (const review of exportData.reviews) {
      const book = review.book as Record<string, unknown> | null;
      csvRows.push(
        [
          escapeCsv(book?.title as string),
          escapeCsv(book?.author as string),
          review.rating,
          escapeCsv(review.summary as string),
          escapeCsv(review.content as string),
          escapeCsv((review.vibe_tags as string[])?.join("; ") || ""),
          review.created_at,
        ].join(",")
      );
    }

    csvRows.push("");
    csvRows.push("=== CHALLENGES ===");
    csvRows.push("Name,Type,Target,Current,Status,Start,End");
    for (const challenge of exportData.challenges) {
      csvRows.push(
        [
          escapeCsv(challenge.name as string),
          challenge.challenge_type,
          challenge.target_value,
          challenge.current_value,
          challenge.status,
          challenge.start_date,
          challenge.end_date,
        ].join(",")
      );
    }

    csvRows.push("");
    csvRows.push("=== READING GOALS ===");
    csvRows.push("Year,Target Books");
    for (const goal of exportData.readingGoals) {
      csvRows.push([goal.year, goal.target_books].join(","));
    }

    csvRows.push("");
    csvRows.push("=== FOLLOWING ===");
    csvRows.push("Username,Display Name,Since");
    for (const f of exportData.following) {
      const following = f.following as Record<string, unknown> | null;
      csvRows.push(
        [
          following?.username || "",
          escapeCsv(following?.display_name as string),
          f.created_at,
        ].join(",")
      );
    }

    csvRows.push("");
    csvRows.push(`Exported at: ${exportData.exportedAt}`);

    return new NextResponse(csvRows.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="ohmyreads-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting data:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}

function escapeCsv(value: string | null | undefined): string {
  if (!value) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
