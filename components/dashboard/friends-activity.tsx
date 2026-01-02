import Image from "next/image";
import Link from "next/link";
import { Users, BookOpen, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { FriendActivity } from "@/lib/queries/follows";

interface FriendsActivityProps {
  activities: FriendActivity[];
}

// Format book status for display
function formatStatus(status: string): string {
  switch (status) {
    case "want_to_read":
      return "wants to read";
    case "reading":
      return "started reading";
    case "read":
      return "finished";
    default:
      return "added";
  }
}

export function FriendsActivity({ activities }: FriendsActivityProps) {
  if (activities.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-xl font-semibold font-serif mb-4">Friends Activity</h2>
        <div
          className={cn(
            "p-6 rounded-xl text-center",
            "bg-gradient-to-br from-accent/5 via-background to-primary/5",
            "border border-border/50"
          )}
        >
          <div className="mb-3 p-3 rounded-full bg-muted inline-flex">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-medium mb-2">No friends activity yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Follow other readers to see what they&apos;re reading
          </p>
          <Link href="/community">
            <Button variant="outline" size="sm">
              Discover Readers
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold font-serif">Friends Activity</h2>
        <Link
          href="/community"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          View all
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-3">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className={cn(
              "flex items-center gap-4 p-3 rounded-lg",
              "bg-card border border-border",
              "hover:bg-muted/50 transition-colors"
            )}
          >
            {/* User Avatar */}
            <Link
              href={`/@${activity.username}`}
              className="flex-shrink-0"
            >
              <div className="relative w-10 h-10 rounded-full overflow-hidden bg-muted">
                {activity.avatar_url ? (
                  <Image
                    src={activity.avatar_url}
                    alt={activity.display_name || activity.username || "User"}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    <Users className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
              </div>
            </Link>

            {/* Book Cover Thumbnail */}
            <Link
              href={`/books/${activity.book_slug}`}
              className="flex-shrink-0"
            >
              <div className="relative w-8 h-12 rounded overflow-hidden bg-muted">
                {activity.book_cover_url ? (
                  <Image
                    src={activity.book_cover_url}
                    alt={activity.book_title}
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    <BookOpen className="w-3 h-3 text-muted-foreground" />
                  </div>
                )}
              </div>
            </Link>

            {/* Activity Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <Link
                  href={`/@${activity.username}`}
                  className="font-medium hover:text-primary transition-colors"
                >
                  {activity.display_name || activity.username}
                </Link>{" "}
                <span className="text-muted-foreground">
                  {formatStatus(activity.status || "added")}
                </span>{" "}
                <Link
                  href={`/books/${activity.book_slug}`}
                  className="font-medium hover:text-primary transition-colors"
                >
                  {activity.book_title}
                </Link>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatRelativeTime(activity.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
