import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  FileText,
  MessageSquare,
  Flame,
  Library,
  ArrowRight,
  Sparkles,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/stat-card";
import { BookListHorizontal } from "@/components/books/book-list-horizontal";
import { RecommendedBooksRow } from "@/components/books/recommended-books-row";
import ActiveChallengesWidget from "@/components/challenges/active-challenges-widget";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  getPersonalizedRecommendations,
  hasEnoughSignals,
} from "@/lib/queries/recommendations";
import { getChallenges } from "@/lib/actions/challenges";
import { getFriendsActivity } from "@/lib/queries/follows";
import { getPendingRequests } from "@/lib/queries/friends";
import { PlacesNearYou } from "@/components/dashboard/places-near-you";
import { FriendsActivity } from "@/components/dashboard/friends-activity";
import { FriendRequestsNotification } from "@/components/dashboard/friend-requests-notification";
import type { Book, UserBook, ReadingStats, Profile } from "@/types/database";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Format book status for display
function formatStatus(status: string): string {
  switch (status) {
    case "want_to_read":
      return "Want to Read";
    case "reading":
      return "Currently Reading";
    case "read":
      return "Read";
    default:
      return status;
  }
}

// Format today's date nicely
function formatTodayDate(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface UserBookWithBook extends UserBook {
  book: Book;
}

interface ActivityItem extends UserBook {
  book: Pick<Book, "id" | "title" | "slug" | "cover_url">;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // Layout handles redirect
  }

  // Fetch all data in parallel
  const [
    profileResult,
    statsResult,
    currentlyReadingResult,
    recentActivityResult,
    hasSignals,
    challengesResult,
    friendsActivityData,
    pendingFriendRequests,
  ] = await Promise.all([
    // Profile
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    // Reading stats
    supabase.from("reading_stats").select("*").eq("user_id", user.id).single(),
    // Currently reading books
    supabase
      .from("user_books")
      .select("*, book:books(*)")
      .eq("user_id", user.id)
      .eq("status", "reading")
      .order("updated_at", { ascending: false })
      .limit(10),
    // Recent activity
    supabase
      .from("user_books")
      .select("*, book:books(id, title, slug, cover_url)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(5),
    // Check if user has enough signals for recommendations
    hasEnoughSignals(user.id),
    // Active challenges
    getChallenges(),
    // Friends activity
    getFriendsActivity(user.id, 5),
    // Pending friend requests
    getPendingRequests(),
  ]);

  const profile = profileResult.data as Profile | null;
  const stats = statsResult.data as ReadingStats | null;
  const currentlyReading = (currentlyReadingResult.data || []) as UserBookWithBook[];
  const recentActivity = (recentActivityResult.data || []) as ActivityItem[];
  const challenges = challengesResult.data || [];

  // Fetch personalized recommendations if user has signals
  const recommendations = hasSignals
    ? await getPersonalizedRecommendations(user.id, 8)
    : [];

  // Extract book objects for the horizontal list
  const currentlyReadingBooks = currentlyReading
    .filter((item) => item.book)
    .map((item) => item.book);

  // Get display name
  const displayName =
    profile?.display_name ||
    profile?.username ||
    user.user_metadata?.full_name ||
    "Reader";

  return (
    <div className="max-w-6xl mx-auto">
      {/* ========================================
          Welcome Header
          ======================================== */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold font-serif mb-1">
          Welcome back, {displayName}
        </h1>
        <p className="text-muted-foreground">{formatTodayDate()}</p>
      </div>

      {/* ========================================
          Friend Requests Notification
          ======================================== */}
      {pendingFriendRequests.length > 0 && (
        <FriendRequestsNotification requests={pendingFriendRequests} />
      )}

      {/* ========================================
          Stats Grid
          ======================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Books Read"
          value={stats?.books_read || 0}
          icon={BookOpen}
        />
        <StatCard
          title="Pages Read"
          value={stats?.pages_read?.toLocaleString() || 0}
          icon={FileText}
        />
        <StatCard
          title="Reviews Written"
          value={stats?.reviews_count || 0}
          icon={MessageSquare}
        />
        <StatCard
          title="Day Streak"
          value={stats?.current_streak || 0}
          icon={Flame}
          subtitle={stats?.current_streak && stats.current_streak > 0 ? "🔥 Keep it going!" : undefined}
          trend={stats?.current_streak && stats.current_streak > 0 ? "up" : "neutral"}
        />
      </div>

      {/* ========================================
          Active Challenges Section
          ======================================== */}
      <ActiveChallengesWidget challenges={challenges} />

      {/* ========================================
          Currently Reading Section
          ======================================== */}
      <BookListHorizontal
        title="Currently Reading"
        books={currentlyReadingBooks}
        emptyMessage="You're not reading anything yet. Find your next book!"
        viewAllHref="/my-shelf?status=reading"
      />

      {/* ========================================
          Places Near You Section
          ======================================== */}
      <PlacesNearYou />

      {/* ========================================
          Friends Activity Section
          ======================================== */}
      <FriendsActivity activities={friendsActivityData} />

      {/* ========================================
          Personalized Recommendations Section
          ======================================== */}
      {recommendations.length > 0 ? (
        <RecommendedBooksRow
          books={recommendations}
          title="Recommended for You"
          viewAllHref="/books"
        />
      ) : !hasSignals ? (
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
                <h3 className="font-semibold mb-1">Get personalized recommendations</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Help us understand your taste by setting up your reading preferences.
                  We&apos;ll recommend books you&apos;ll love.
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
      ) : null}

      {/* ========================================
          Recent Activity Section
          ======================================== */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold font-serif mb-4">Recent Activity</h2>

        {recentActivity.length > 0 ? (
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-lg",
                  "bg-card border border-border",
                  "hover:bg-muted/50 transition-colors"
                )}
              >
                {/* Book Cover Thumbnail */}
                <Link
                  href={`/books/${activity.book.slug}`}
                  className="flex-shrink-0"
                >
                  <div className="relative w-10 h-14 rounded overflow-hidden bg-muted">
                    {activity.book.cover_url ? (
                      <Image
                        src={activity.book.cover_url}
                        alt={activity.book.title}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full">
                        <BookOpen className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </Link>

                {/* Activity Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    Added{" "}
                    <Link
                      href={`/books/${activity.book.slug}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {activity.book.title}
                    </Link>{" "}
                    to{" "}
                    <span className="text-primary font-medium">
                      {formatStatus(activity.status)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatRelativeTime(activity.updated_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Library}
            title="No activity yet"
            description="Start by adding a book to your shelf to track your reading journey."
            action={{
              label: "Browse Books",
              href: "/books",
            }}
            secondaryAction={{
              label: "Import from Goodreads",
              href: "/import",
              icon: Upload,
            }}
          />
        )}
      </section>

      {/* ========================================
          Quick Actions (for new users)
          ======================================== */}
      {!stats && currentlyReading.length === 0 && (
        <section className="mb-8">
          <div
            className={cn(
              "p-6 rounded-xl text-center",
              "bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5",
              "border border-primary/20"
            )}
          >
            <h3 className="text-lg font-semibold mb-2">
              Ready to start your reading journey?
            </h3>
            <p className="text-muted-foreground mb-4">
              Discover books, track your progress, and connect with other readers.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/books">
                <Button>
                  Browse Books
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/import">
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Import from Goodreads
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
