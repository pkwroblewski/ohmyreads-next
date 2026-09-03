import { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { createClient, getUser } from "@/lib/supabase/server";
import {
  getCuratedBooks,
  getPersonalizedRecommendations,
  hasEnoughSignals,
  type RecommendedBook,
} from "@/lib/queries/recommendations";
import { RecommendationsGrid } from "@/components/recommendations/recommendations-grid";

export const metadata: Metadata = {
  title: "Curated For You - OhMyReads",
  description:
    "Personalized book recommendations based on your reading preferences, favorite genres, and books you've loved.",
  openGraph: {
    title: "Curated For You - OhMyReads",
    description:
      "Discover your next favorite read with personalized recommendations.",
  },
};

interface RecommendationsPageProps {
  searchParams: Promise<{
    genre?: string;
  }>;
}

export default async function RecommendationsPage({
  searchParams,
}: RecommendationsPageProps) {
  const params = await searchParams;
  const genreFilter = params.genre;

  // Check if user is logged in
  const supabase = await createClient();
  const {
    data: { user },
  } = await getUser();

  // Get recommendations
  let recommendations: RecommendedBook[] = [];
  let isPersonalized = false;
  let userGenres: string[] = [];

  if (user) {
    const hasSignals = await hasEnoughSignals(user.id);
    if (hasSignals) {
      recommendations = await getPersonalizedRecommendations(user.id, 24);
      isPersonalized = true;

      // Get user's preferred genres for display
      const { data: tasteProfile } = await supabase
        .from("user_taste_profiles")
        .select("preferred_genres")
        .eq("user_id", user.id)
        .single();

      userGenres = tasteProfile?.preferred_genres || [];
    } else {
      recommendations = await getCuratedBooks(user.id, 24);
    }
  } else {
    recommendations = await getCuratedBooks(undefined, 24);
  }

  // Apply genre filter if specified
  if (genreFilter && genreFilter !== "All Genres") {
    recommendations = recommendations.filter(
      (book) => book.genres?.includes(genreFilter)
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold font-serif">
              {isPersonalized ? "Curated For You" : "Recommended Books"}
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl">
            {isPersonalized
              ? "Personalized picks based on your reading taste, favorite genres, and books you've loved."
              : user
              ? "Complete your taste profile to get personalized recommendations. For now, here are our top picks."
              : "Sign in and set up your reading preferences to get personalized recommendations."}
          </p>

          {/* Personalization indicator */}
          {isPersonalized && userGenres.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">
                Based on your love for:
              </span>
              {userGenres.slice(0, 5).map((genre) => (
                <span
                  key={genre}
                  className="text-sm px-3 py-1 rounded-full bg-primary/10 text-primary font-medium"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Recommendations Grid with Filters */}
        <RecommendationsGrid
          initialBooks={recommendations}
          initialGenre={genreFilter}
          isPersonalized={isPersonalized}
          isLoggedIn={!!user}
        />
      </div>
    </main>
  );
}
