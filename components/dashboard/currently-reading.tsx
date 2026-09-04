import { createClient, getUser } from "@/lib/supabase/server";
import {
  BookListHorizontal,
  type RailProgress,
} from "@/components/books/book-list-horizontal";
import { BOOK_CARD_COLUMNS } from "@/lib/queries/columns";
import type { BookSummary, UserBook } from "@/types/database";

interface UserBookWithBook extends UserBook {
  book: BookSummary;
}

/**
 * Server component that fetches and displays currently reading books.
 * Wrapped in Suspense by parent for independent loading.
 */
export async function CurrentlyReading() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await getUser();

  if (!user) {
    return null;
  }

  // Fetch currently reading books
  const { data } = await supabase
    .from("user_books")
    .select(`*, book:books(${BOOK_CARD_COLUMNS})`)
    .eq("user_id", user.id)
    .eq("status", "reading")
    .order("updated_at", { ascending: false })
    .limit(10);

  const currentlyReading = (data || []) as UserBookWithBook[];

  // Extract book objects for the horizontal list
  const books = currentlyReading.filter((item) => item.book).map((item) => item.book);

  // Every book in this rail is being read right now, so each one carries its
  // own bar and its own one-tap way into the progress dialog.
  const progressByBookId: Record<string, RailProgress> = {};
  for (const item of currentlyReading) {
    if (!item.book) continue;
    progressByBookId[item.book.id] = {
      currentPage: item.current_page,
      totalPages: item.total_pages,
      percent: item.progress_percentage,
    };
  }

  return (
    <BookListHorizontal
      title="Currently Reading"
      books={books}
      progressByBookId={progressByBookId}
      emptyTitle="Start your reading journey"
      emptyMessage="You're not reading anything yet. Add a book to get started!"
      emptyAction={{
        label: "Browse Books",
        href: "/books",
      }}
      viewAllHref="/my-shelf?status=reading"
    />
  );
}
