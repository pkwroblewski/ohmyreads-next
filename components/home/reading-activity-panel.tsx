import Link from "next/link";
import Image from "next/image";
import { BookOpen, Target, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HomeReadingActivity } from "@/lib/queries/home";

interface ReadingActivityPanelProps {
  activity: HomeReadingActivity | null;
  isLoggedIn: boolean;
}

// Placeholder blur
const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzMzMyIvPjwvc3ZnPg==";

export function ReadingActivityPanel({
  activity,
  isLoggedIn,
}: ReadingActivityPanelProps) {
  // Logged out: show preview + CTA
  if (!isLoggedIn) {
    return (
      <div className="h-full flex flex-col">
        <h3 className="text-lg font-semibold font-serif mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Your Reading Activity
        </h3>

        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          {/* Mock progress bar */}
          <div className="w-full max-w-[200px] mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>2025 Reading Challenge</span>
              <span>0/12</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full w-0 bg-primary rounded-full" />
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Sign in to track your reading goals and see your progress.
          </p>

          <Link href="/signup">
            <Button size="sm">
              Get Started
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Logged in: show goal + currently reading
  const goal = activity?.goal;
  const currentlyReading = activity?.currentlyReading || [];
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
                <div className="flex-shrink-0 w-10 h-[60px] rounded overflow-hidden bg-muted">
                  {item.book.cover_url ? (
                    <Image
                      src={item.book.cover_url}
                      alt={item.book.title}
                      width={40}
                      height={60}
                      className="object-cover w-full h-full"
                      placeholder="blur"
                      blurDataURL={BLUR_DATA_URL}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
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
          <div className="text-center py-4">
            <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No books in progress
            </p>
            <Link
              href="/books"
              className="text-xs text-primary hover:underline"
            >
              Find something to read
            </Link>
          </div>
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

