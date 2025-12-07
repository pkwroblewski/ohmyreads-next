import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookOpen, CheckCircle, Bookmark, Library } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/stat-card";
import { ShelfTabs } from "@/components/books/shelf-tabs";
import { ShelfBookCard } from "@/components/books/shelf-book-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Book, UserBook } from "@/types/database";

export const metadata: Metadata = {
  title: "My Shelf",
};

interface UserBookWithBook extends UserBook {
  book: Book | null;
}

export default async function MyShelfPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;

  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's books with book details
  const { data: userBooks } = await supabase
    .from("user_books")
    .select(
      `
      *,
      book:books(*)
    `
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const allBooks = (userBooks as UserBookWithBook[]) || [];

  // Count by status
  const counts = {
    all: allBooks.length,
    reading: allBooks.filter((b) => b.status === "reading").length,
    read: allBooks.filter((b) => b.status === "read").length,
    want_to_read: allBooks.filter((b) => b.status === "want_to_read").length,
  };

  // Filter books based on URL param
  let filteredBooks = allBooks;
  if (statusFilter && statusFilter !== "all") {
    filteredBooks = allBooks.filter((b) => b.status === statusFilter);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-serif">My Shelf</h1>
        <p className="text-muted-foreground">
          {counts.all} book{counts.all !== 1 ? "s" : ""} in your collection
        </p>
      </div>

      {/* Stats Cards */}
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

      {/* Tab Navigation */}
      <ShelfTabs activeStatus={statusFilter || "all"} counts={counts} />

      {/* Book Grid */}
      {filteredBooks.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
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
          title={getEmptyTitle(statusFilter)}
          description={getEmptyDescription(statusFilter)}
          action={{
            label: "Browse Books",
            href: "/books",
          }}
        />
      )}
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
