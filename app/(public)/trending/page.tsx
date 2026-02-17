import { Metadata } from "next";
import { Flame } from "lucide-react";
import { getTrulyTrending } from "@/lib/queries/recommendations";
import { TrendingGrid } from "@/components/trending/trending-grid";

export const metadata: Metadata = {
  title: "Trending Books - OhMyReads",
  description:
    "Discover what readers are buzzing about right now. See the most talked-about books this week based on reviews, ratings, and reader activity.",
  openGraph: {
    title: "Trending Books - OhMyReads",
    description:
      "Discover what readers are buzzing about right now.",
  },
};

interface TrendingPageProps {
  searchParams: Promise<{
    period?: string;
    genre?: string;
  }>;
}

export default async function TrendingPage({ searchParams }: TrendingPageProps) {
  const params = await searchParams;
  const period = params.period || "week";
  const genre = params.genre;

  // Map period to days
  const daysWindow =
    period === "week" ? 7 :
    period === "month" ? 30 :
    365; // all time = 1 year

  // Fetch trending books
  const trendingBooks = await getTrulyTrending(24, daysWindow, genre);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-red-500">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold font-serif">
              Trending Books
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Discover what readers are buzzing about right now. Rankings based on
            recent reviews, ratings, and shelf activity.
          </p>
        </div>

        {/* Trending Grid with Filters */}
        <TrendingGrid
          initialBooks={trendingBooks}
          initialPeriod={period}
          initialGenre={genre}
        />
      </div>
    </main>
  );
}
