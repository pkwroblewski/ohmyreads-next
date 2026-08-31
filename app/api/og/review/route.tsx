import { ImageResponse } from "@vercel/og";
import { createPublicClient } from "@/lib/supabase/server";
import { logError } from "@/lib/utils/log";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get("id");

    if (!reviewId) {
      return new Response("Missing review id parameter", { status: 400 });
    }

    const supabase = createPublicClient();

    // Fetch review with book and user info
    const { data: review, error } = await supabase
      .from("reviews")
      .select("content, summary, rating, user_id, book_id")
      .eq("id", reviewId)
      .single();

    if (error || !review) {
      return new Response("Review not found", { status: 404 });
    }

    // Fetch book and user in parallel
    const [bookResult, userResult] = await Promise.all([
      supabase.from("books").select("title, author, cover_url").eq("id", review.book_id).single(),
      supabase.from("profiles").select("username, display_name, avatar_url").eq("id", review.user_id).single(),
    ]);

    const book = bookResult.data;
    const user = userResult.data;

    if (!book) {
      return new Response("Book not found", { status: 404 });
    }

    const displayName = user?.display_name || user?.username || "Reader";
    const reviewText = review.summary || review.content || "";
    const truncatedReview = reviewText.length > 200
      ? reviewText.substring(0, 200) + "..."
      : reviewText;

    // Generate star display
    const stars = review.rating != null
      ? "★".repeat(review.rating) + "☆".repeat(5 - review.rating)
      : null;

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            backgroundColor: "#faf8f5",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {/* Left Side - Book Cover */}
          <div
            style={{
              width: "35%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px",
            }}
          >
            {book.cover_url ? (
              <img
                src={book.cover_url}
                width={220}
                height={330}
                style={{
                  borderRadius: "10px",
                  boxShadow: "0 15px 30px rgba(0,0,0,0.15)",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: "220px",
                  height: "330px",
                  backgroundColor: "#4a5d4a",
                  borderRadius: "10px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  padding: "20px",
                  textAlign: "center",
                  boxShadow: "0 15px 30px rgba(0,0,0,0.15)",
                }}
              >
                <span style={{ fontSize: "20px", fontWeight: "bold" }}>
                  {book.title}
                </span>
              </div>
            )}
          </div>

          {/* Right Side - Review */}
          <div
            style={{
              width: "65%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "40px 50px 40px 20px",
              gap: "16px",
            }}
          >
            {/* Book Title & Author */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <h2
                style={{
                  fontSize: "28px",
                  fontWeight: "bold",
                  color: "#2d3b2d",
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                {book.title}
              </h2>
              <p style={{ fontSize: "18px", color: "#6b7c6b", margin: 0 }}>
                by {book.author}
              </p>
            </div>

            {/* Rating */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {stars && <span style={{ fontSize: "24px", color: "#d4a853" }}>{stars}</span>}
            </div>

            {/* Review Quote */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "16px",
                boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
                borderLeft: "4px solid #4a5d4a",
              }}
            >
              <span style={{ fontSize: "28px", color: "#4a5d4a", lineHeight: 1 }}>
                &ldquo;
              </span>
              <p
                style={{
                  fontSize: "18px",
                  color: "#3d4d3d",
                  margin: 0,
                  lineHeight: 1.5,
                  fontStyle: "italic",
                }}
              >
                {truncatedReview}
              </p>
            </div>

            {/* User Info */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  width={40}
                  height={40}
                  style={{ borderRadius: "50%", border: "2px solid #e8e4df" }}
                />
              ) : (
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: "#4a5d4a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "16px",
                    fontWeight: "bold",
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span style={{ fontSize: "16px", color: "#6b7c6b" }}>
                Review by <span style={{ fontWeight: "600", color: "#4a5d4a" }}>{displayName}</span>
              </span>
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  backgroundColor: "#4a5d4a",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "12px",
                }}
              >
                📚
              </div>
              <span style={{ fontSize: "14px", color: "#8b9c8b" }}>
                ohmyreads.com
              </span>
            </div>
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
