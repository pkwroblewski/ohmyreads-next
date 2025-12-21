import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getRecommendedReaders, browseReaders } from "@/lib/queries/discover";
import { ReadersLikeYou } from "@/components/discover/readers-like-you";
import { ReaderBrowser } from "@/components/discover/reader-browser";

export const metadata: Metadata = {
  title: "Discover Readers | OhMyReads",
  description:
    "Find readers with similar taste. Discover new book lovers based on shared reading interests, genres, and vibes.",
  openGraph: {
    title: "Discover Readers | OhMyReads",
    description:
      "Find readers with similar taste. Discover new book lovers based on shared reading interests.",
    type: "website",
  },
};

export default async function DiscoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch data in parallel
  const [recommendations, initialBrowse] = await Promise.all([
    // Get recommendations if logged in
    user
      ? getRecommendedReaders(user.id, { limit: 6, excludeFollowing: true })
      : Promise.resolve([]),
    // Get initial browse results
    browseReaders({
      currentUserId: user?.id,
      filters: {
        sortBy: user ? "compatibility" : "followers",
      },
      page: 1,
      limit: 20,
    }),
  ]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl sm:text-3xl font-bold font-serif">
            Discover Readers
          </h1>
          <p className="text-muted-foreground mt-2">
            Find readers with similar taste and connect with fellow book lovers
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Recommendations Section (only for logged-in users) */}
        {user && recommendations.length > 0 && (
          <ReadersLikeYou readers={recommendations} />
        )}

        {/* Not logged in notice */}
        {!user && (
          <div className="mb-8 p-4 rounded-lg bg-muted/50 border text-center">
            <p className="text-sm text-muted-foreground">
              <a href="/login" className="text-primary hover:underline font-medium">
                Sign in
              </a>{" "}
              to see personalized reader recommendations based on your reading
              taste.
            </p>
          </div>
        )}

        {/* Browse Section */}
        <ReaderBrowser
          initialReaders={initialBrowse.readers}
          currentUserId={user?.id}
          initialTotal={initialBrowse.total}
        />
      </div>
    </div>
  );
}
