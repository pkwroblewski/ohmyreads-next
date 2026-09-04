import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, BookOpen, CheckCircle, Bookmark, Library, Upload } from "lucide-react";
import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/stat-card";
import { ShelfTabs } from "@/components/books/shelf-tabs";
import { ShelfGrid, type ShelfGridItem } from "@/components/books/shelf-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { ShelfSidebar } from "@/components/shelves/shelf-sidebar";
import { MobileShelfDrawer } from "@/components/shelves/mobile-shelf-drawer";
import { getShelfCounts, getUserBooks, SHELF_PAGE_SIZE } from "@/lib/queries/users";

export const metadata: Metadata = {
  title: "Bookshelves",
};

type ShelfStatus = "reading" | "read" | "want_to_read";

function toStatus(raw: string | undefined): ShelfStatus | undefined {
  return raw === "reading" || raw === "read" || raw === "want_to_read" ? raw : undefined;
}

export default async function MyShelfPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; shelf?: string }>;
}) {
  const { status: statusFilter, shelf: shelfFilter } = await searchParams;

  // Get current user
  const {
    data: { user },
  } = await getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // Counts are three HEAD requests, the grid is one page of 48 rows, and a
  // custom shelf filters through the shelf_books join in the same query — so
  // the page no longer loads (and, past 1,000 rows, silently truncates) the
  // whole collection just to count it.
  const [counts, page, shelf] = await Promise.all([
    getShelfCounts(user.id),
    getUserBooks(user.id, {
      status: shelfFilter ? undefined : toStatus(statusFilter),
      shelfId: shelfFilter,
      limit: SHELF_PAGE_SIZE,
      offset: 0,
    }),
    shelfFilter
      ? supabase
          .from("user_shelves")
          .select("name")
          .eq("id", shelfFilter)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const shelfName = shelf.data?.name ?? null;
  const books = page.userBooks as ShelfGridItem[];
  const total = page.total;

  return (
    <div className="flex gap-6">
      {/* Sidebar with Custom Shelves - Desktop */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <ShelfSidebar activeShelfId={shelfFilter} />
      </aside>

      {/* Main Content */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Back to Dashboard */}
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to Dashboard"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-serif">
              {shelfName ? shelfName : "Bookshelves"}
            </h1>
            <p className="text-muted-foreground">
              {shelfFilter
                ? `${total} book${total !== 1 ? "s" : ""} in this shelf`
                : `${counts.all} book${counts.all !== 1 ? "s" : ""} in your collection`}
            </p>
          </div>
          {/* Mobile Custom Shelves Button */}
          <div className="lg:hidden">
            <MobileShelfDrawer activeShelfId={shelfFilter} />
          </div>
        </div>

        {/* Stats Cards (only show when not filtering by custom shelf) */}
        {!shelfFilter && (
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              title="Currently Reading"
              value={counts.reading}
              icon={BookOpen}
            />
            <StatCard
              title="Completed"
              value={counts.read}
              icon={CheckCircle}
            />
            <StatCard
              title="Want to Read"
              value={counts.want_to_read}
              icon={Bookmark}
            />
          </div>
        )}

        {/* Tab Navigation (only show when not filtering by custom shelf) */}
        {!shelfFilter && (
          <ShelfTabs activeStatus={statusFilter || "all"} counts={counts} />
        )}

        {/* Book Grid */}
        {books.length > 0 ? (
          <ShelfGrid
            key={`${shelfFilter ?? ""}:${statusFilter ?? "all"}`}
            initialBooks={books}
            total={total}
            status={statusFilter}
            shelfId={shelfFilter}
            pageSize={SHELF_PAGE_SIZE}
          />
        ) : (
          <EmptyState
            icon={Library}
            title={shelfFilter ? "No books in this shelf" : getEmptyTitle(statusFilter)}
            description={
              shelfFilter
                ? "Add books to this shelf from your library"
                : getEmptyDescription(statusFilter)
            }
            action={{
              label: "Browse Books",
              href: "/books",
            }}
            secondaryAction={
              !statusFilter || statusFilter === "all"
                ? {
                    label: "Import from Goodreads",
                    href: "/import",
                    icon: Upload,
                  }
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

// Helper functions for empty states
function getEmptyTitle(status?: string) {
  switch (status) {
    case "reading":
      return "Not reading anything";
    case "read":
      return "No books completed yet";
    case "want_to_read":
      return "No books on your wishlist";
    default:
      return "Your shelf is empty";
  }
}

function getEmptyDescription(status?: string) {
  switch (status) {
    case "reading":
      return "Start a book and track your progress!";
    case "read":
      return "Finish a book and add it to your completed list";
    case "want_to_read":
      return "Save books you want to read later";
    default:
      return "Discover books and add them to your collection";
  }
}
