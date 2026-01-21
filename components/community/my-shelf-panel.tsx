import Link from "next/link";
import { BookOpen, ArrowRight, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, getInitials } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CoverImage } from "@/components/books/cover-image";
import type { HomeReadingActivity } from "@/lib/queries/home";

interface MyShelfPanelProps {
  activity: HomeReadingActivity | null;
  user: {
    id: string;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

export function MyShelfPanel({ activity, user }: MyShelfPanelProps) {
  // Logged out state
  if (!user) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <h3 className="text-lg font-semibold font-serif">Bookshelves</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Track your reading journey and share your progress with the community.
            </p>
            <Link href="/signup">
              <Button size="sm" className="w-full">
                <Sparkles className="w-4 h-4 mr-1.5" />
                Get Started
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayName = user.display_name || user.username || "Reader";
  const goal = activity?.goal;
  const currentlyReading = activity?.currentlyReading || [];
  const progressPercent = goal
    ? Math.min(Math.round((goal.progress / goal.target) * 100), 100)
    : 0;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* User Info */}
        <div className="flex items-center gap-3">
          <Link href={`/users/${user.username || user.id}`}>
            <Avatar size="lg">
              {user.avatar_url ? (
                <AvatarImage src={user.avatar_url} alt={displayName} />
              ) : (
                <AvatarFallback initials={getInitials(displayName)} />
              )}
            </Avatar>
          </Link>
          <div>
            <Link
              href={`/users/${user.username || user.id}`}
              className="font-semibold hover:text-primary transition-colors"
            >
              {displayName}
            </Link>
            {goal && (
              <p className="text-sm text-muted-foreground">
                Reading Challenge: {goal.progress}/{goal.target} Books
              </p>
            )}
          </div>
        </div>

        {/* Goal Progress */}
        {goal && (
          <div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Currently Reading */}
        {currentlyReading.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Currently Reading
            </h4>
            <div className="space-y-2">
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
                    {/* Progress bar placeholder */}
                    <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden w-full max-w-[100px]">
                      <div className="h-full w-1/3 bg-primary/50 rounded-full" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Link to shelf */}
        <Link
          href="/my-shelf"
          className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
        >
          View Bookshelves
          <ArrowRight className="w-3 h-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

