import { Card, CardContent } from "@/components/ui/card";
import { ReadingActivityPanel } from "./reading-activity-panel";
import { CuratedMiniGrid } from "./curated-mini-grid";
import { TrendingNowList } from "./trending-now-list";
import type { Book } from "@/types/database";
import type { HomeReadingActivity } from "@/lib/queries/home";

interface HomeFeedProps {
  activity: HomeReadingActivity | null;
  curatedBooks: Book[];
  trendingBooks: Book[];
  isLoggedIn: boolean;
}

export function HomeFeed({
  activity,
  curatedBooks,
  trendingBooks,
  isLoggedIn,
}: HomeFeedProps) {
  const hasContent = curatedBooks.length > 0 || trendingBooks.length > 0;

  if (!hasContent && !isLoggedIn) {
    return null;
  }

  return (
    <section className="py-8 lg:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 3-panel layout on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Panel 1: Reading Activity */}
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4 lg:p-5 h-full">
              <ReadingActivityPanel
                activity={activity}
                isLoggedIn={isLoggedIn}
              />
            </CardContent>
          </Card>

          {/* Panel 2: Curated / Personalized */}
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4 lg:p-5 h-full">
              <CuratedMiniGrid
                books={curatedBooks}
                title={isLoggedIn ? "Personalized Recommendations" : "Curated for You"}
                isLoggedIn={isLoggedIn}
              />
            </CardContent>
          </Card>

          {/* Panel 3: Trending Now */}
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4 lg:p-5 h-full">
              <TrendingNowList
                books={trendingBooks}
                title="Trending Now"
                maxItems={5}
                variant="panel"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
