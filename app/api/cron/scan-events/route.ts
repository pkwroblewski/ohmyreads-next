import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateEventsSummary } from "@/lib/ai/events-summary";
import type { BookEvent } from "@/lib/queries/events";

/**
 * POST /api/cron/scan-events
 *
 * Weekly cron job to generate AI summaries for regions with events.
 * Should be called by Vercel Cron or similar scheduler.
 *
 * Headers:
 * - Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabase = createAdminClient();

  try {
    // Get the start of current week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff)).toISOString().split("T")[0];

    // Get today's date for filtering
    const today = new Date().toISOString().split("T")[0];

    // Get all unique geohash prefixes (2-char) from upcoming events
    const { data: events, error: eventsError } = await supabase
      .from("book_events")
      .select("id, title, event_type, venue_name, start_date, geohash, city")
      .gte("start_date", today)
      .not("geohash", "is", null);

    if (eventsError) {
      throw eventsError;
    }

    if (!events || events.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No events to process",
        summaries_generated: 0,
      });
    }

    // Group events by 2-char geohash prefix
    const eventsByRegion = new Map<string, BookEvent[]>();

    for (const event of events) {
      if (!event.geohash) continue;
      const prefix = event.geohash.slice(0, 2);
      if (!eventsByRegion.has(prefix)) {
        eventsByRegion.set(prefix, []);
      }
      eventsByRegion.get(prefix)!.push(event as BookEvent);
    }

    // Generate summaries for each region
    const summaries: Array<{
      geohash_prefix: string;
      week_start: string;
      summary: string;
      event_count: number;
    }> = [];

    for (const [prefix, regionEvents] of eventsByRegion) {
      // Get city name for context (use most common city in region)
      const cities = regionEvents
        .map((e) => e.city)
        .filter(Boolean) as string[];
      const cityCount = new Map<string, number>();
      for (const city of cities) {
        cityCount.set(city, (cityCount.get(city) || 0) + 1);
      }
      const topCity = [...cityCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

      // Generate AI summary
      const summary = await generateEventsSummary(regionEvents, topCity);

      summaries.push({
        geohash_prefix: prefix,
        week_start: weekStart,
        summary,
        event_count: regionEvents.length,
      });
    }

    // Upsert all summaries
    if (summaries.length > 0) {
      const { error: upsertError } = await supabase
        .from("book_events_summaries")
        .upsert(summaries, {
          onConflict: "geohash_prefix,week_start",
        });

      if (upsertError) {
        throw upsertError;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${summaries.length} summaries`,
      summaries_generated: summaries.length,
      regions: summaries.map((s) => s.geohash_prefix),
    });
  } catch (error) {
    console.error("Error in scan-events cron:", error);
    return NextResponse.json(
      { error: "Failed to generate event summaries" },
      { status: 500 }
    );
  }
}

// Also support GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}
