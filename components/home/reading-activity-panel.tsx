import Link from "next/link";
import { BookOpen, Target, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/books/cover-image";
import { cn } from "@/lib/utils";
import type { HomeReadingActivity } from "@/lib/queries/home";

interface ReadingActivityPanelProps {
  activity: HomeReadingActivity | null;
  isLoggedIn: boolean;
}

// Sample books for the preview (static)
const SAMPLE_BOOKS = [
  {
    id: "sample-1",
    title: "The Midnight Library",
    author: "Matt Haig",
    progress: 68,
    coverGradient: "from-indigo-400 to-violet-500",
  },
  {
    id: "sample-2",
    title: "Project Hail Mary",
    author: "Andy Weir",
    progress: 34,
    coverGradient: "from-amber-400 to-orange-500",
  },
];

// Compute a "lightly personalized" sample progress based on current date
function getSampleProgress(goalTarget: number): number {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  // Progress roughly proportional to time in year, with slight variance
  const baseProgress = Math.floor((dayOfYear / 365) * goalTarget);
  const variance = (dayOfYear % 3) - 1; // -1, 0, or 1
  return Math.max(1, Math.min(goalTarget - 2, baseProgress + variance));
}

export function ReadingActivityPanel({
  activity,
  isLoggedIn,
}: ReadingActivityPanelProps) {
  const currentYear = new Date().getFullYear();
  const sampleGoal = 12;
  const sampleProgress = getSampleProgress(sampleGoal);
  const samplePercent = Math.round((sampleProgress / sampleGoal) * 100);

  // ─────────────────────────────────────────────────────────────────────────
  // STATE A: Logged out → Preview mode with sample data
  // ─────────────────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="h-full flex flex-col">
        {/* Header with Preview pill */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold font-serif flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Your Reading Activity
          </h3>
          <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            Preview
          </span>
        </div>

        {/* Sample Goal Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium">{currentYear} Reading Challenge</span>
            <span className="text-muted-foreground">
              {sampleProgress}/{sampleGoal} books
            </span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
              style={{ width: `${samplePercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Example goal progress
          </p>
        </div>

        {/* Sample Currently Reading */}
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-2">
            Currently Reading
          </p>
          <div className="space-y-3">
            {SAMPLE_BOOKS.map((book) => (
              <div key={book.id} className="flex gap-3 opacity-90">
                {/* Gradient placeholder cover */}
                <div
                  className={cn(
                    "flex-shrink-0 w-10 h-[60px] rounded overflow-hidden",
                    "bg-gradient-to-br",
                    book.coverGradient
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">
                    {book.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {book.author}
                  </p>
                  <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden w-full max-w-[100px]">
                    <div
                      className="h-full bg-primary/50 rounded-full"
                      style={{ width: `${book.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 italic">
            Example books
          </p>
        </div>

        {/* CTA */}
        <div className="mt-4 space-y-2">
          <Link href="/signup" className="block">
            <Button size="sm" className="w-full">
              <Sparkles className="w-4 h-4 mr-1.5" />
              Start Tracking
            </Button>
          </Link>
          <p className="text-xs text-center text-muted-foreground">
            Join 2k+ readers tracking their goals
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOGGED IN: Check if user has activity
  // ─────────────────────────────────────────────────────────────────────────
  const goal = activity?.goal;
  const currentlyReading = activity?.currentlyReading || [];
  const hasGoal = !!goal;
  const hasBooks = currentlyReading.length > 0;
  const isEmpty = !hasGoal && !hasBooks;

  // ─────────────────────────────────────────────────────────────────────────
  // STATE B: Logged in, but empty → Setup scaffold
  // ─────────────────────────────────────────────────────────────────────────
  if (isEmpty) {
    return (
      <div className="h-full flex flex-col">
        <h3 className="text-lg font-semibold font-serif mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Your Reading Activity
        </h3>

        {/* Setup steps */}
        <div className="flex-1 space-y-3">
          {/* Step 1: Set Goal */}
          <Link
            href="/stats"
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium group-hover:text-primary transition-colors">
                Set your {currentYear} reading goal
              </p>
              <p className="text-xs text-muted-foreground">
                Track your progress all year
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>

          {/* Step 2: Add Book */}
          <Link
            href="/books"
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium group-hover:text-primary transition-colors">
                Add your first book
              </p>
              <p className="text-xs text-muted-foreground">
                Start tracking what you read
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>

          {/* Skeleton preview of what's to come */}
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2">
              Once you start, you'll see:
            </p>
            <div className="space-y-2 opacity-50">
              {/* Skeleton book card */}
              <div className="flex gap-3">
                <div className="w-8 h-12 rounded bg-muted animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-2 w-1/2 rounded bg-muted animate-pulse" />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-12 rounded bg-muted animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
                  <div className="h-2 w-1/3 rounded bg-muted animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Link to dashboard */}
        <Link
          href="/dashboard"
          className="mt-4 text-sm text-primary hover:text-primary/80 flex items-center gap-1"
        >
          Go to dashboard
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATE C: Logged in with real data
  // ─────────────────────────────────────────────────────────────────────────
  const progressPercent = goal
    ? Math.min(Math.round((goal.progress / goal.target) * 100), 100)
    : 0;

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-lg font-semibold font-serif mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-primary" />
        Your Reading Activity
      </h3>

      {/* Reading Goal Progress */}
      {goal ? (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium">{goal.year} Reading Challenge</span>
            <span className="text-muted-foreground">
              {goal.progress}/{goal.target} books
            </span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {progressPercent}% complete
          </p>
        </div>
      ) : (
        <Link
          href="/stats"
          className="block mb-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
        >
          <p className="text-sm font-medium">Set a reading goal</p>
          <p className="text-xs text-muted-foreground">
            Track your progress throughout the year
          </p>
        </Link>
      )}

      {/* Currently Reading */}
      <div className="flex-1">
        <p className="text-sm font-medium text-muted-foreground mb-2">
          Currently Reading
        </p>
        {currentlyReading.length > 0 ? (
          <div className="space-y-3">
            {currentlyReading.map((item) => (
              <Link
                key={item.id}
                href={`/books/${item.book.slug}`}
                className="flex gap-3 group"
              >
                <CoverImage
                  book={item.book}
                  width={40}
                  height={60}
                  hover={false}
                  className="flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
                    {item.book.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.book.author}
                  </p>
                  <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden w-full max-w-[100px]">
                    <div className="h-full w-1/3 bg-primary/50 rounded-full" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Link
            href="/books"
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
          >
            <BookOpen className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
            <div>
              <p className="text-sm font-medium group-hover:text-primary transition-colors">
                Find something to read
              </p>
              <p className="text-xs text-muted-foreground">
                Browse our collection
              </p>
            </div>
          </Link>
        )}
      </div>

      {/* Link to dashboard */}
      <Link
        href="/dashboard"
        className="mt-4 text-sm text-primary hover:text-primary/80 flex items-center gap-1"
      >
        View all activity
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
