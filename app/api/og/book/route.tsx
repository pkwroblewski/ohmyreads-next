import { ImageResponse } from "@vercel/og";
import { createPublicClient } from "@/lib/supabase/server";
import { logError } from "@/lib/utils/log";
import { isAllowedImageHost } from "@/lib/config/image-hosts";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return new Response("Missing slug parameter", { status: 400 });
    }

    const supabase = createPublicClient();

    const { data: book, error } = await supabase
      .from("books")
      .select(
        "title, author, cover_url, genres, average_rating, ratings_count, local_average_rating, local_ratings_count, page_count"
      )
      .eq("slug", slug)
      .single();

    if (error || !book) {
      return new Response("Book not found", { status: 404 });
    }

    const genres = (book.genres || []).slice(0, 3);

    // Two rating populations (migration 063). The card is this site's share
    // image, so its own readers' figure comes first; the Open Library one is
    // shown only as a fallback and says where it is from.
    const hasLocal =
      book.local_average_rating !== null && book.local_ratings_count > 0;
    const rating = hasLocal
      ? book.local_average_rating!.toFixed(1)
      : book.average_rating
        ? book.average_rating.toFixed(1)
        : null;
    const ratingCount = hasLocal
      ? book.local_ratings_count
      : book.ratings_count || 0;
    const ratingLabel = hasLocal
      ? `from ${ratingCount} ${ratingCount === 1 ? "reader" : "readers"} on OhMyReads`
      : `${ratingCount} ${ratingCount === 1 ? "rating" : "ratings"} on Open Library`;

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
              width: "45%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "50px",
            }}
          >
            {isAllowedImageHost(book.cover_url) ? (
              <img
                src={book.cover_url}
                width={280}
                height={420}
                style={{
                  borderRadius: "12px",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: "280px",
                  height: "420px",
                  backgroundColor: "#4a5d4a",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  padding: "30px",
                  textAlign: "center",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                }}
              >
                <span style={{ fontSize: "28px", fontWeight: "bold" }}>
                  {book.title}
                </span>
              </div>
            )}
          </div>

          {/* Right Side - Book Info */}
          <div
            style={{
              width: "55%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "50px 50px 50px 0",
              gap: "20px",
            }}
          >
            {/* Title */}
            <h1
              style={{
                fontSize: "42px",
                fontWeight: "bold",
                color: "#2d3b2d",
                margin: 0,
                lineHeight: 1.2,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {book.title}
            </h1>

            {/* Author */}
            <p
              style={{
                fontSize: "24px",
                color: "#6b7c6b",
                margin: 0,
              }}
            >
              by {book.author}
            </p>

            {/* Rating */}
            {rating && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: "#d4a853",
                    color: "white",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    fontSize: "20px",
                    fontWeight: "bold",
                  }}
                >
                  <span>★</span>
                  <span>{rating}</span>
                </div>
                <span style={{ fontSize: "16px", color: "#8b9c8b" }}>
                  {ratingLabel}
                </span>
              </div>
            )}

            {/* Page count */}
            {book.page_count && (
              <p style={{ fontSize: "18px", color: "#8b9c8b", margin: 0 }}>
                {book.page_count} pages
              </p>
            )}

            {/* Genres */}
            {genres.length > 0 && (
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {genres.map((genre: string) => (
                  <div
                    key={genre}
                    style={{
                      backgroundColor: "#e8e4df",
                      color: "#4a5d4a",
                      padding: "8px 16px",
                      borderRadius: "16px",
                      fontSize: "14px",
                      fontWeight: "500",
                    }}
                  >
                    {genre}
                  </div>
                ))}
              </div>
            )}

            {/* CTA */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  backgroundColor: "#4a5d4a",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "16px",
                }}
              >
                📚
              </div>
              <span style={{ fontSize: "18px", color: "#4a5d4a", fontWeight: "500" }}>
                Find it on OhMyReads
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
