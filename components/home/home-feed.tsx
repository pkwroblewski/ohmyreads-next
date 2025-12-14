import { BookRecommendationRow } from "@/components/books/book-recommendation-row";
import { TrendingNowList } from "./trending-now-list";
import type { Book } from "@/types/database";

interface HomeFeedProps {
  curatedBooks: Book[];
  trendingPlatform: Book[];
  trendingGlobal: Book[];
  isLoggedIn?: boolean;
}

export function HomeFeed({
  curatedBooks,
  trendingPlatform,
  trendingGlobal,
  isLoggedIn,
}: HomeFeedProps) {
  const hasMainContent = curatedBooks.length > 0 || trendingPlatform.length > 0;
  const hasSidebar = trendingGlobal.length > 0;

  if (!hasMainContent && !hasSidebar) {
    return null;
  }

  return (
    <section className="py-10 lg:py-14">
      <div className="mx-auto max-w-7xl">
        {/* Two-column layout on desktop */}
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-8">
          {/* Main column: Book carousels */}
          <div className="space-y-10 lg:space-y-12">
            {/* Curated / Personalized */}
            {curatedBooks.length > 0 && (
              <BookRecommendationRow
                title={isLoggedIn ? "Recommended for You" : "Curated for You"}
                subtitle={
                  isLoggedIn
                    ? "Based on your reading history"
                    : "Popular highly-rated books"
                }
                books={curatedBooks}
                viewAllHref="/books"
              />
            )}

            {/* Trending on Platform */}
            {trendingPlatform.length > 0 && (
              <BookRecommendationRow
                title="Trending on OhMyReads"
                subtitle="What readers are adding to their shelves"
                books={trendingPlatform}
                viewAllHref="/books?sort=trending"
              />
            )}
          </div>

          {/* Sidebar: Trending Now list */}
          {hasSidebar && (
            <aside className="hidden lg:block">
              <div className="sticky top-24 rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4">
                <TrendingNowList
                  books={trendingGlobal}
                  title="Trending Now"
                  maxItems={6}
                />
              </div>
            </aside>
          )}
        </div>

        {/* Mobile: Show trending globally as a carousel */}
        {hasSidebar && (
          <div className="lg:hidden mt-10">
            <BookRecommendationRow
              title="Trending Globally"
              subtitle="Most popular books worldwide"
              books={trendingGlobal}
              viewAllHref="/books?sort=popular"
            />
          </div>
        )}
      </div>
    </section>
  );
}

