import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateOrigin } from "@/lib/utils/csrf";

// Valid atmosphere tags
const ATMOSPHERE_TAGS = [
  "cozy",
  "quiet",
  "busy",
  "well-lit",
  "good-coffee",
  "great-selection",
  "helpful-staff",
  "good-for-reading",
  "power-outlets",
  "wifi",
  "outdoor-seating",
  "pet-friendly",
];

/**
 * GET /api/geo/places/[id]/reviews
 * Get all reviews for a place
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: placeId } = await params;

  if (!placeId) {
    return NextResponse.json({ error: "Place ID required" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    const { data: reviews, error } = await supabase
      .from("place_reviews")
      .select(
        `
        id,
        rating,
        content,
        atmosphere_tags,
        created_at,
        updated_at,
        user:profiles!place_reviews_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .eq("place_id", placeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reviews:", error);
      return NextResponse.json(
        { error: "Failed to fetch reviews" },
        { status: 500 }
      );
    }

    // Also get the place's aggregate stats
    const { data: place } = await supabase
      .from("places")
      .select("average_rating, reviews_count")
      .eq("id", placeId)
      .single();

    return NextResponse.json({
      reviews: reviews || [],
      stats: {
        averageRating: place?.average_rating || null,
        reviewsCount: place?.reviews_count || 0,
      },
    });
  } catch (error) {
    console.error("Error in reviews GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/geo/places/[id]/reviews
 * Create or update a review for a place
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: placeId } = await params;

  if (!placeId) {
    return NextResponse.json({ error: "Place ID required" }, { status: 400 });
  }

  // Check authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // CSRF protection: validate origin
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { rating, content, atmosphereTags } = body;

    // Validate rating
    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be a number between 1 and 5" },
        { status: 400 }
      );
    }

    // Validate atmosphere tags
    const validTags = (atmosphereTags || []).filter((tag: string) =>
      ATMOSPHERE_TAGS.includes(tag)
    );

    // Check if place exists
    const adminSupabase = createAdminClient();
    const { data: place, error: placeError } = await adminSupabase
      .from("places")
      .select("id")
      .eq("id", placeId)
      .single();

    if (placeError || !place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    // Upsert the review (one review per user per place)
    const { data: review, error } = await adminSupabase
      .from("place_reviews")
      .upsert(
        {
          place_id: placeId,
          user_id: user.id,
          rating: Math.round(rating),
          content: content?.trim() || null,
          atmosphere_tags: validTags,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "place_id,user_id",
        }
      )
      .select(
        `
        id,
        rating,
        content,
        atmosphere_tags,
        created_at,
        updated_at
      `
      )
      .single();

    if (error) {
      console.error("Error saving review:", error);
      return NextResponse.json(
        { error: "Failed to save review" },
        { status: 500 }
      );
    }

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error("Error in reviews POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/geo/places/[id]/reviews
 * Delete the current user's review for a place
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: placeId } = await params;

  if (!placeId) {
    return NextResponse.json({ error: "Place ID required" }, { status: 400 });
  }

  // Check authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // CSRF protection: validate origin
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const adminSupabase = createAdminClient();

    const { error } = await adminSupabase
      .from("place_reviews")
      .delete()
      .eq("place_id", placeId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting review:", error);
      return NextResponse.json(
        { error: "Failed to delete review" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in reviews DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
