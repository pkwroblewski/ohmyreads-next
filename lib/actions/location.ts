"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { encodeGeohash, isValidGeohash } from "@/lib/utils/geohash";

// ============================================
// UPDATE LOCATION
// ============================================

interface UpdateLocationInput {
  lat: number;
  lng: number;
  label: string;
  precision?: number;
}

/**
 * Update user's location (from coordinates)
 */
export async function updateLocation(input: UpdateLocationInput) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Rate limit
    const { allowed } = await checkRateLimit(`location:${user.id}`, 10, 60000);
    if (!allowed) {
      return { error: "Too many requests. Please wait a moment." };
    }

    // Validate coordinates
    if (input.lat < -90 || input.lat > 90 || input.lng < -180 || input.lng > 180) {
      return { error: "Invalid coordinates" };
    }

    // Validate label
    if (!input.label || input.label.length > 200) {
      return { error: "Invalid location label" };
    }

    // Use precision (default 6 = ~1.2km)
    const precision = Math.min(Math.max(input.precision || 6, 4), 8);
    const geohash = encodeGeohash(input.lat, input.lng, precision);

    // Update profile
    const { error } = await supabase
      .from("profiles")
      .update({
        location_enabled: true,
        location_geohash: geohash,
        location_label: input.label.slice(0, 200),
        location_precision: precision,
        location_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.error("Error updating location:", error);
      return { error: "Failed to update location" };
    }

    revalidatePath("/settings");
    revalidatePath("/profile");

    return { success: true, geohash, label: input.label };
  } catch (error) {
    console.error("Error in updateLocation:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Update user's location from a geohash (for city search results)
 */
export async function updateLocationFromGeohash(input: {
  geohash: string;
  label: string;
  precision?: number;
}) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Rate limit
    const { allowed } = await checkRateLimit(`location:${user.id}`, 10, 60000);
    if (!allowed) {
      return { error: "Too many requests. Please wait a moment." };
    }

    // Validate geohash
    if (!input.geohash || !isValidGeohash(input.geohash)) {
      return { error: "Invalid geohash" };
    }

    // Validate label
    if (!input.label || input.label.length > 200) {
      return { error: "Invalid location label" };
    }

    // Apply precision (truncate geohash)
    const precision = Math.min(Math.max(input.precision || 6, 4), 8);
    const geohash = input.geohash.slice(0, precision);

    // Update profile
    const { error } = await supabase
      .from("profiles")
      .update({
        location_enabled: true,
        location_geohash: geohash,
        location_label: input.label.slice(0, 200),
        location_precision: precision,
        location_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.error("Error updating location:", error);
      return { error: "Failed to update location" };
    }

    revalidatePath("/settings");
    revalidatePath("/profile");

    return { success: true };
  } catch (error) {
    console.error("Error in updateLocationFromGeohash:", error);
    return { error: "An unexpected error occurred" };
  }
}

// ============================================
// TOGGLE LOCATION SHARING
// ============================================

/**
 * Enable or disable location sharing
 */
export async function toggleLocationSharing(enabled: boolean) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Rate limit
    const { allowed } = await checkRateLimit(`location:${user.id}`, 10, 60000);
    if (!allowed) {
      return { error: "Too many requests. Please wait a moment." };
    }

    // Update profile - clear location data when disabling for privacy
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update(
        enabled
          ? { location_enabled: true, location_updated_at: now }
          : {
              location_enabled: false,
              location_geohash: null,
              location_label: null,
              location_precision: 6,
              location_updated_at: now,
            }
      )
      .eq("id", user.id);

    if (error) {
      console.error("Error toggling location:", error);
      return { error: "Failed to update setting" };
    }

    revalidatePath("/settings");
    revalidatePath("/profile");

    return { success: true };
  } catch (error) {
    console.error("Error in toggleLocationSharing:", error);
    return { error: "An unexpected error occurred" };
  }
}

// ============================================
// UPDATE PRECISION
// ============================================

/**
 * Update location precision (how approximate the location is)
 */
export async function updateLocationPrecision(precision: number) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Validate precision (4-8)
    const validPrecision = Math.min(Math.max(precision, 4), 8);

    // Get current location
    const { data: profile } = await supabase
      .from("profiles")
      .select("location_geohash")
      .eq("id", user.id)
      .single();

    // Truncate geohash if we have one
    const updates: Record<string, unknown> = {
      location_precision: validPrecision,
      location_updated_at: new Date().toISOString(),
    };

    if (profile?.location_geohash) {
      // Re-encode with new precision (truncate)
      updates.location_geohash = profile.location_geohash.slice(0, validPrecision);
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      console.error("Error updating precision:", error);
      return { error: "Failed to update precision" };
    }

    revalidatePath("/settings");

    return { success: true };
  } catch (error) {
    console.error("Error in updateLocationPrecision:", error);
    return { error: "An unexpected error occurred" };
  }
}

// ============================================
// SET PRESENCE
// ============================================

export type PresenceType = "static" | "temporary" | "recommended";

interface SetPresenceInput {
  type: PresenceType;
  durationHours?: number; // For temporary: 1, 2, or 4 hours
  note?: string; // Optional note (max 140 chars)
}

/**
 * Set the user's presence type for their current location.
 * - static: Permanent home location (default)
 * - temporary: "I'm here now" - auto-expires after durationHours
 * - recommended: "Great reading spot" - expires after 7 days
 */
export async function setPresence(input: SetPresenceInput) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Rate limit
    const { allowed } = await checkRateLimit(`presence:${user.id}`, 10, 60000);
    if (!allowed) {
      return { error: "Too many requests. Please wait a moment." };
    }

    // Validate note length
    if (input.note && input.note.length > 140) {
      return { error: "Note must be 140 characters or less" };
    }

    // Validate duration for temporary presence
    if (input.type === "temporary") {
      const validDurations = [1, 2, 4];
      if (!input.durationHours || !validDurations.includes(input.durationHours)) {
        return { error: "Invalid duration. Must be 1, 2, or 4 hours." };
      }
    }

    // Calculate expires_at based on type
    let expiresAt: string | null = null;
    if (input.type === "temporary" && input.durationHours) {
      expiresAt = new Date(Date.now() + input.durationHours * 60 * 60 * 1000).toISOString();
    } else if (input.type === "recommended") {
      // Recommended spots expire after 7 days
      expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Update profile
    const { error } = await supabase
      .from("profiles")
      .update({
        presence_type: input.type,
        presence_expires_at: expiresAt,
        presence_note: input.note?.slice(0, 140) || null,
        location_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.error("Error setting presence:", error);
      return { error: "Failed to set presence" };
    }

    revalidatePath("/settings");
    revalidatePath("/profile");
    revalidatePath("/geo");

    return { success: true, expiresAt };
  } catch (error) {
    console.error("Error in setPresence:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Clear the user's presence (revert to static with no note)
 */
export async function clearPresence() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        presence_type: "static",
        presence_expires_at: null,
        presence_note: null,
        location_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.error("Error clearing presence:", error);
      return { error: "Failed to clear presence" };
    }

    revalidatePath("/settings");
    revalidatePath("/profile");
    revalidatePath("/geo");

    return { success: true };
  } catch (error) {
    console.error("Error in clearPresence:", error);
    return { error: "An unexpected error occurred" };
  }
}

// ============================================
// CLEAR LOCATION
// ============================================

/**
 * Clear user's location data entirely
 */
export async function clearLocation() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Update profile
    const { error } = await supabase
      .from("profiles")
      .update({
        location_enabled: false,
        location_geohash: null,
        location_label: null,
        location_precision: 6,
        location_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.error("Error clearing location:", error);
      return { error: "Failed to clear location" };
    }

    revalidatePath("/settings");
    revalidatePath("/profile");

    return { success: true };
  } catch (error) {
    console.error("Error in clearLocation:", error);
    return { error: "An unexpected error occurred" };
  }
}

