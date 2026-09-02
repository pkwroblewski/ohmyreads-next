import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/utils/log";

/**
 * DEBUG: Get raw reader data for the current user
 * This helps diagnose precision issues
 */
export async function GET() {
  // Disable debug endpoint in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if user is admin
  const { data: adminCheck } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!adminCheck?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get the current user's profile data (own row via RPC — the location and
  // presence columns are not directly selectable since migration 065)
  const { data: profile, error } = await supabase.rpc("get_my_profile").single();

  if (error) {
    return NextResponse.json(
      { error: reportError("Reader debug profile fetch failed", error) },
      { status: 500 }
    );
  }

  // Return raw data for debugging
  return NextResponse.json({
    debug: {
      userId: user.id,
      profile: {
        location_enabled: profile?.location_enabled,
        location_geohash: profile?.location_geohash,
        location_geohash_length: profile?.location_geohash?.length || 0,
        location_label: profile?.location_label,
        presence_type: profile?.presence_type,
        presence_type_typeof: typeof profile?.presence_type,
        presence_expires_at: profile?.presence_expires_at,
        presence_note: profile?.presence_note,
      },
      analysis: {
        isCheckIn: profile?.presence_type === "temporary" || profile?.presence_type === "recommended",
        wouldReturnFullGeohash: profile?.presence_type === "temporary" || profile?.presence_type === "recommended",
        expectedGeohashInAPI: (profile?.presence_type === "temporary" || profile?.presence_type === "recommended")
          ? profile?.location_geohash
          : profile?.location_geohash?.slice(0, 4),
      }
    }
  });
}
