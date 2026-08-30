import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, BookOpen, CheckCircle, Bookmark, Library, Upload } from "lucide-react";
import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/stat-card";
import { ShelfTabs } from "@/components/books/shelf-tabs";
import { ShelfBookCard } from "@/components/books/shelf-book-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ShelfSidebar } from "@/components/shelves/shelf-sidebar";
import { MobileShelfDrawer } from "@/components/shelves/mobile-shelf-drawer";
import { BOOK_CARD_COLUMNS } from "@/lib/queries/columns";
import type { BookSummary, UserBook } from "@/types/database";

export const metadata: Metadata = {
  title: "Bookshelves",
};

interface UserBookWithBook extends UserBook {
  book: BookSummary | null;
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

  // If filtering by custom shelf, get those books
  let filteredBooks: UserBookWithBook[] = [];
  let allBooks: UserBookWithBook[] = [];
  let shelfName: string | null = null;

  if (shelfFilter) {
    // Get shelf info
    const { data: shelf } = await supabase
      .from("user_shelves")
      .select("name")
      .eq("id", shelfFilter)
      .eq("user_id", user.id)
      .single();

    shelfName = shelf?.name || null;

    // Get books in this custom shelf - first get shelf_book entries
    const { data: shelfBookEntries } = await supabase
      .from("shelf_books")
      .select("user_book_id")
      .eq("shelf_id", shelfFilter);

    const shelfUserBookIds = (shelfBookEntries || []).map((sb) => sb.user_book_id);

    if (shelfUserBookIds.length > 0) {
      const { data: shelfUserBooks } = await supabase
        .from("user_books")
        .select(`*, book:books(${BOOK_CARD_COLUMNS})`)
        .in("id", shelfUserBookIds);

      filteredBooks = (shelfUserBooks as UserBookWithBook[]) || [];
    }

    // Still need all books for counts
    const { data: userBooks } = await supabase
      .from("user_books")
      .select(`*, book:books(${BOOK_CARD_COLUMNS})`)
      .eq("user_id", user.id);

    allBooks = (userBooks as UserBookWithBook[]) || [];
  } else {
    // Get all user's books
    const { data: userBooks } = await supabase
      .from("user_books")
      .select(`
        *,
        book:books(${BOOK_CARD_COLUMNS})
      `)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    allBooks = (userBooks as UserBookWithBook[]) || [];

    // Filter by status if specified
    filteredBooks = allBooks;
    if (statusFilter && statusFilter !== "all") {
      filteredBooks = allBooks.filter((b) => b.status === statusFilter);
    }
  }

  // Count by status
  const counts = {
    all: allBooks.length,
    reading: allBooks.filter((b) => b.status === "reading").length,
    read: allBooks.filter((b) => b.status === "read").length,
    want_to_read: allBooks.filter((b) => b.status === "want_to_read").length,
  };

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
                ? `${filteredBooks.length} book${filteredBooks.length !== 1 ? "s" : ""} in this shelf`
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
        {filteredBooks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
            {filteredBooks.map((userBook) => (
              <ShelfBookCard
                key={userBook.id}
                userBook={userBook}
                book={userBook.book}
              />
            ))}
          </div>
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
