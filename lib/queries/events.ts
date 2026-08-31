import { createPublicClient } from "@/lib/supabase/server";
import { getNeighbors, isValidGeohash } from "@/lib/utils/geohash";
import { logError } from "@/lib/utils/log";

export interface BookEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: "signing" | "reading" | "festival" | "club" | "workshop" | "other";
  venue_name: string;
  venue_address: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  geohash: string | null;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  url: string | null;
  image_url: string | null;
  is_featured: boolean;
  created_at: string;
}

export interface EventsSummary {
  summary: string;
  event_count: number;
  generated_at: string;
}

/**
 * Get upcoming events near a location
 */
export async function getEventsNearby(
  geohashPrefix: string,
  limit: number = 20
): Promise<BookEvent[]> {
  if (!geohashPrefix || !isValidGeohash(geohashPrefix)) {
    return [];
  }

  const supabase = createPublicClient();

  // Get neighboring cells for broader coverage
  const prefix = geohashPrefix.slice(0, 3); // Use 3-char prefix for region (~150km)
  const searchHashes = getNeighbors(prefix);
  const patterns = searchHashes.map((h) => `${h}%`);

  // Get today's date for filtering upcoming events
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("book_events")
    .select("*")
    .or(patterns.map((p) => `geohash.like.${p}`).join(","))
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .order("is_featured", { ascending: false })
    .limit(limit);

  if (error) {
    logError("Error fetching events", error);
    return [];
  }

  // DB stores event_type as plain text; narrow to the app union at the boundary
  return (data as BookEvent[]) || [];
}

/**
 * Get weekly AI summary for a region
 */
export async function getWeeklySummary(
  geohashPrefix: string
): Promise<EventsSummary | null> {
  if (!geohashPrefix || !isValidGeohash(geohashPrefix)) {
    return null;
  }

  const supabase = createPublicClient();

  // Use 2-char prefix for broader regional summary
  const prefix = geohashPrefix.slice(0, 2);

  // Get the start of current week (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff)).toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("book_events_summaries")
    .select("summary, event_count, generated_at")
    .eq("geohash_prefix", prefix)
    .eq("week_start", weekStart)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    summary: data.summary,
    event_count: data.event_count ?? 0,
    generated_at: data.generated_at ?? "",
  };
}

/**
 * Get events by city name
 */
export async function getEventsByCity(
  city: string,
  limit: number = 20
): Promise<BookEvent[]> {
  const supabase = createPublicClient();

  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("book_events")
    .select("*")
    .ilike("city", `%${city}%`)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(limit);

  if (error) {
    logError("Error fetching events by city", error);
    return [];
  }

  return (data as BookEvent[]) || [];
}

/**
 * Get featured events globally
 */
export async function getFeaturedEvents(limit: number = 10): Promise<BookEvent[]> {
  const supabase = createPublicClient();

  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("book_events")
    .select("*")
    .eq("is_featured", true)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(limit);

  if (error) {
    logError("Error fetching featured events", error);
    return [];
  }

  return (data as BookEvent[]) || [];
}
