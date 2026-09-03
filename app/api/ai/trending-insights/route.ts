import { NextResponse } from "next/server";
import { getCachedTrendingInsights } from "@/lib/ai/trending-insights";
import { getUser } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { logError } from "@/lib/utils/log";

/**
 * Trending insights as JSON. The homepage no longer calls this — it reads
 * `getCachedTrendingInsights()` server-side — but the entry is shared, so a
 * hit here costs no generation the page has not already paid for.
 */
export async function GET() {
  try {
    // Check authentication
    const { data: { user }, error: authError } = await getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Rate limiting: 10 requests per minute per user
    const { allowed } = await checkRateLimit(`ai-trending:${user.id}`, 10, 60000);

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const insights = await getCachedTrendingInsights();

    if (insights.length === 0) {
      return NextResponse.json({ insights: [], error: "No trending books found" });
    }

    return NextResponse.json({ insights, cached: false });
  } catch (error) {
    logError("Trending insights error", error);
    return NextResponse.json(
      { error: "Failed to generate insights", insights: [] },
      { status: 500 }
    );
  }
}
