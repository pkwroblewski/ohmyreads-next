import { ImageResponse } from "@vercel/og";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/utils/log";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return new Response("Missing userId parameter", { status: 400 });
    }

    // Fetch user data
    const supabase = await createClient();

    const [profileResult, booksResult, reviewsResult] = await Promise.all([
      supabase.from("profiles").select("username, display_name, avatar_url").eq("id", userId).single(),
      supabase
        .from("user_books")
        .select("book:books(page_count, genres)")
        .eq("user_id", userId)
        .eq("status", "read"),
      supabase.from("reviews").select("rating").eq("user_id", userId),
    ]);

    const profile = profileResult.data;
    const books = booksResult.data || [];
    const reviews = reviewsResult.data || [];

    const displayName = profile?.display_name || profile?.username || "Reader";
    const totalBooks = books.length;

    // Type the book data properly - Supabase can return single object or array
    type BookData = { page_count: number | null; genres: string[] };

    const getBookData = (b: (typeof books)[number]): BookData | null => {
      const book = b.book;
      if (!book) return null;
      if (Array.isArray(book)) return book[0] || null;
      return book as BookData;
    };

    const totalPages = books.reduce((sum, b) => {
      const bookData = getBookData(b);
      return sum + (bookData?.page_count || 0);
    }, 0);
    const ratedReviews = reviews.filter((r) => r.rating != null);
    const avgRating = ratedReviews.length > 0
      ? (ratedReviews.reduce((sum, r) => sum + r.rating!, 0) / ratedReviews.length).toFixed(1)
      : "0";

    // Get top genres
    const genreCounts = new Map<string, number>();
    books.forEach((b) => {
      const bookData = getBookData(b);
      (bookData?.genres || []).forEach((g: string) => {
        genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
      });
    });
    const topGenres = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre);

    const currentYear = new Date().getFullYear();

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#faf8f5",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "40px 50px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  backgroundColor: "#4a5d4a",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "20px",
                }}
              >
                📚
              </div>
              <span style={{ fontSize: "24px", fontWeight: "bold", color: "#2d3b2d" }}>
                OhMyReads
              </span>
            </div>
            <span style={{ fontSize: "20px", color: "#6b7c6b" }}>
              {currentYear} Reading Stats
            </span>
          </div>

          {/* Main Content */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px 50px",
              gap: "30px",
            }}
          >
            {/* User Info */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px",
              }}
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  width={80}
                  height={80}
                  style={{ borderRadius: "50%", border: "4px solid #4a5d4a" }}
                />
              ) : (
                <div
                  style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "50%",
                    backgroundColor: "#4a5d4a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "32px",
                    fontWeight: "bold",
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span style={{ fontSize: "28px", fontWeight: "bold", color: "#2d3b2d" }}>
                {displayName}
              </span>
            </div>

            {/* Stats Grid */}
            <div
              style={{
                display: "flex",
                gap: "40px",
                justifyContent: "center",
              }}
            >
              {/* Books */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  backgroundColor: "white",
                  padding: "30px 50px",
                  borderRadius: "20px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                }}
              >
                <span style={{ fontSize: "56px", fontWeight: "bold", color: "#4a5d4a" }}>
                  {totalBooks}
                </span>
                <span style={{ fontSize: "18px", color: "#6b7c6b" }}>Books Read</span>
              </div>

              {/* Pages */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  backgroundColor: "white",
                  padding: "30px 50px",
                  borderRadius: "20px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                }}
              >
                <span style={{ fontSize: "56px", fontWeight: "bold", color: "#c4956a" }}>
                  {totalPages.toLocaleString()}
                </span>
                <span style={{ fontSize: "18px", color: "#6b7c6b" }}>Pages</span>
              </div>

              {/* Rating */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  backgroundColor: "white",
                  padding: "30px 50px",
                  borderRadius: "20px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                }}
              >
                <span style={{ fontSize: "56px", fontWeight: "bold", color: "#d4a853" }}>
                  {avgRating}
                </span>
                <span style={{ fontSize: "18px", color: "#6b7c6b" }}>Avg Rating</span>
              </div>
            </div>

            {/* Top Genres */}
            {topGenres.length > 0 && (
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
                {topGenres.map((genre) => (
                  <div
                    key={genre}
                    style={{
                      backgroundColor: "#4a5d4a",
                      color: "white",
                      padding: "8px 20px",
                      borderRadius: "20px",
                      fontSize: "16px",
                    }}
                  >
                    {genre}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "20px",
              borderTop: "1px solid #e8e4df",
            }}
          >
            <span style={{ fontSize: "16px", color: "#8b9c8b" }}>
              ohmyreads.com
            </span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    logError("Error generating OG image", error);
    return new Response("Failed to generate image", { status: 500 });
  }
}
