import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { RecommendedBooksRow } from "@/components/books/recommended-books-row";
import {
  getPersonalizedRecommendations,
  hasEnoughSignals,
} from "@/lib/queries/recommendations";
import { cn } from "@/lib/utils";

/**
 * Server component that fetches and displays personalized recommendations.
 * Wrapped in Suspense by parent for independent loading.
 */
export async function RecommendationsSection() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Check if user has enough signals for recommendations
  const hasSignals = await hasEnoughSignals(user.id);

  // Fetch personalized recommendations if user has signals
  const recommendations = hasSignals
    ? await getPersonalizedRecommendations(user.id, 8)
    : [];

  // Show recommendations if we have them
  if (recommendations.length > 0) {
    return (
      <RecommendedBooksRow
        books={recommendations}
        title="Recommended for You"
        viewAllHref="/books"
      />
    );
  }

  // Show onboarding prompt if user lacks signals
  if (!hasSignals) {
    return (
      <section className="mb-8">
        <div
          className={cn(
            "p-5 rounded-xl",
            "bg-gradient-to-br from-accent/10 via-primary/5 to-accent/5",
            "border border-accent/20"
          )}
        >
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-accent/20">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">
                Get personalized recommendations
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Help us understand your taste by setting up your reading
                preferences. We&apos;ll recommend books you&apos;ll love.
              </p>
              <div className="flex gap-2">
                <Link href="/onboarding/taste">
                  <Button size="sm" variant="default">
                    Set up my taste profile
                  </Button>
                </Link>
                <Link href="/settings">
                  <Button size="sm" variant="outline">
                    Go to Settings
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Return nothing if user has signals but no recommendations yet
  return null;
}
