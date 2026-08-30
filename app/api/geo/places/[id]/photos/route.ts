import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateOrigin } from "@/lib/utils/csrf";
import { checkRateLimit } from "@/lib/utils/rate-limit";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Stored extension is derived from the verified MIME type, never from the
// user-supplied filename (which can carry a second, executable extension).
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Magic number signatures for allowed image types
const FILE_SIGNATURES: Record<string, number[][]> = {
  "image/jpeg": [
    [0xff, 0xd8, 0xff], // JPEG/JFIF
  ],
  "image/png": [
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG
  ],
  "image/webp": [
    [0x52, 0x49, 0x46, 0x46], // RIFF (WebP starts with RIFF....WEBP)
  ],
};

/**
 * Validate file content matches expected image type by checking magic numbers
 */
function validateFileSignature(buffer: ArrayBuffer, mimeType: string): boolean {
  const signatures = FILE_SIGNATURES[mimeType];
  if (!signatures) return false;

  const bytes = new Uint8Array(buffer);

  for (const signature of signatures) {
    if (bytes.length < signature.length) continue;

    let matches = true;
    for (let i = 0; i < signature.length; i++) {
      if (bytes[i] !== signature[i]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      // Additional check for WebP: verify WEBP identifier at bytes 8-11
      if (mimeType === "image/webp") {
        if (bytes.length < 12) return false;
        const webpSignature = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
        for (let i = 0; i < 4; i++) {
          if (bytes[8 + i] !== webpSignature[i]) return false;
        }
      }
      return true;
    }
  }

  return false;
}

/**
 * GET /api/geo/places/[id]/photos
 * Get all approved photos for a place
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

    const { data: photos, error } = await supabase
      .from("place_photos")
      .select(
        `
        id,
        storage_path,
        caption,
        created_at,
        user:profiles!place_photos_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .eq("place_id", placeId)
      .eq("is_approved", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching photos:", error);
      return NextResponse.json(
        { error: "Failed to fetch photos" },
        { status: 500 }
      );
    }

    // Generate public URLs for photos
    const photosWithUrls = (photos || []).map((photo) => ({
      ...photo,
      url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/place-photos/${photo.storage_path}`,
    }));

    return NextResponse.json({ photos: photosWithUrls });
  } catch (error) {
    console.error("Error in photos GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/geo/places/[id]/photos
 * Upload a photo for a place
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

  // Rate limit by user (10 uploads per hour — each write costs storage)
  const { allowed } = await checkRateLimit(
    `place-photo:${user.id}`,
    10,
    3600000
  );

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const caption = formData.get("caption") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

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

    const arrayBuffer = await file.arrayBuffer();

    // Validate file signature (magic numbers) to prevent spoofed MIME types
    if (!validateFileSignature(arrayBuffer, file.type)) {
      return NextResponse.json(
        { error: "File content does not match declared type" },
        { status: 400 }
      );
    }

    // Generate unique filename from the now-verified MIME type
    const ext = EXTENSION_BY_TYPE[file.type];
    const filename = `${placeId}/${user.id}/${Date.now()}.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await adminSupabase.storage
      .from("place-photos")
      .upload(filename, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload photo" },
        { status: 500 }
      );
    }

    // Create database record
    const { data: photo, error: dbError } = await adminSupabase
      .from("place_photos")
      .insert({
        place_id: placeId,
        user_id: user.id,
        storage_path: filename,
        caption: caption?.trim() || null,
      })
      .select("id, storage_path, caption, created_at")
      .single();

    if (dbError) {
      console.error("Error saving photo record:", dbError);
      // Try to clean up uploaded file
      await adminSupabase.storage.from("place-photos").remove([filename]);
      return NextResponse.json(
        { error: "Failed to save photo" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        photo: {
          ...photo,
          url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/place-photos/${photo.storage_path}`,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in photos POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/geo/places/[id]/photos
 * Delete a photo (user can only delete their own)
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
    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get("photoId");

    if (!photoId) {
      return NextResponse.json({ error: "Photo ID required" }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // Get the photo to verify ownership and get storage path
    const { data: photo, error: fetchError } = await adminSupabase
      .from("place_photos")
      .select("id, user_id, storage_path")
      .eq("id", photoId)
      .eq("place_id", placeId)
      .single();

    if (fetchError || !photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Verify ownership
    if (photo.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only delete your own photos" },
        { status: 403 }
      );
    }

    // Delete from storage
    const { error: storageError } = await adminSupabase.storage
      .from("place-photos")
      .remove([photo.storage_path]);

    if (storageError) {
      console.error("Error deleting from storage:", storageError);
      // Continue anyway to delete the database record
    }

    // Delete from database
    const { error: deleteError } = await adminSupabase
      .from("place_photos")
      .delete()
      .eq("id", photoId);

    if (deleteError) {
      console.error("Error deleting photo record:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete photo" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in photos DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
