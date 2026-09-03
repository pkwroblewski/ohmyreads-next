import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ReadingActivityPanel } from "./reading-activity-panel";
import { CuratedMiniGrid } from "./curated-mini-grid";
import { TrendingNowList } from "./trending-now-list";
import { UnifiedSearch } from "@/components/search/unified-search";
import type { BookSummary } from "@/types/database";
import type { HomeReadingActivity } from "@/lib/queries/home";
import type { TrendingInsight } from "@/lib/ai/trending-insights";

interface HomeFeedProps {
  activity: HomeReadingActivity | null;
  curatedBooks: BookSummary[];
  trendingBooks: BookSummary[];
  /**
   * Resolved server-side by the page and not awaited there: on a cache hit it
   * is already settled, on the daily miss the list streams in without its
   * blurbs first so the LLM round-trips never sit in the page's TTFB.
   */
  trendingInsights: Promise<TrendingInsight[]>;
  isLoggedIn: boolean;
}

export function HomeFeed({
  activity,
  curatedBooks,
  trendingBooks,
  trendingInsights,
  isLoggedIn,
}: HomeFeedProps) {
  const hasContent = curatedBooks.length > 0 || trendingBooks.length > 0;

  if (!hasContent && !isLoggedIn) {
    return null;
  }

  return (
    <section className="py-8 lg:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Unified Search - Instant search + AI Discovery */}
        <div className="mb-6">
          <UnifiedSearch />
        </div>

        {/* 3-panel layout on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Panel 1: Reading Activity */}
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-5 lg:p-6 h-full">
              <ReadingActivityPanel
                activity={activity}
                isLoggedIn={isLoggedIn}
              />
            </CardContent>
          </Card>

          {/* Panel 2: Curated / Personalized */}
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-5 lg:p-6 h-full">
              <CuratedMiniGrid
                books={curatedBooks}
                title={isLoggedIn ? "Personalized Recommendations" : "Curated for You"}
                isLoggedIn={isLoggedIn}
              />
            </CardContent>
          </Card>

          {/* Panel 3: Trending Now */}
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-5 lg:p-6 h-full">
              <Suspense
                fallback={
                  <TrendingNowList
                    books={trendingBooks}
                    title="Trending Now"
                    maxItems={7}
                    variant="panel"
                  />
                }
              >
                <TrendingNowWithInsights
                  books={trendingBooks}
                  insights={trendingInsights}
                />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

async function TrendingNowWithInsights({
  books,
  insights,
}: {
  books: BookSummary[];
  insights: Promise<TrendingInsight[]>;
}) {
  return (
    <TrendingNowList
      books={books}
      insights={await insights}
      title="Trending Now"
      maxItems={7}
      variant="panel"
    />
  );
}
