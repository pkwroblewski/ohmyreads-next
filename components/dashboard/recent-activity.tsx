import Link from "next/link";
import { Library, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { CoverImageMini } from "@/components/books/cover-image";
import type { Book, UserBook } from "@/types/database";

interface ActivityItem extends UserBook {
  book: Pick<Book, "id" | "title" | "slug" | "cover_url">;
}

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

/**
 * Server component that fetches and displays recent activity.
 * Wrapped in Suspense by parent for independent loading.
 */
export async function RecentActivity() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Fetch recent activity
  const { data } = await supabase
    .from("user_books")
    .select("*, book:books(id, title, slug, cover_url)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(5);

  const recentActivity = (data || []) as ActivityItem[];

  return (
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
                <CoverImageMini book={activity.book} />
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
  );
}
