import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BookCard } from "./book-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ReadingProgressCard } from "./reading-progress-card";
import { cn } from "@/lib/utils";
import type { BookSummary } from "@/types/database";

interface EmptyStateAction {
  label: string;
  href: string;
  icon?: LucideIcon;
}

/** One reader's position in one book, as the rail needs it. */
export interface RailProgress {
  currentPage: number | null;
  totalPages: number | null;
  percent: number | null;
}

interface BookListHorizontalProps {
  title: string;
  books: BookSummary[];
  emptyMessage?: string;
  emptyTitle?: string;
  emptyAction?: EmptyStateAction;
  viewAllHref?: string;
  /**
   * Book id to the viewer's progress. A book with an entry gets the bar and
   * the "update progress" control under its cover; every other rail passes
   * nothing and is unchanged.
   */
  progressByBookId?: Record<string, RailProgress>;
}

export function BookListHorizontal({
  title,
  books,
  emptyMessage = "No books to display",
  emptyTitle = "Nothing here yet",
  emptyAction,
  viewAllHref,
  progressByBookId,
}: BookListHorizontalProps) {
  return (
    <section className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold font-serif">{title}</h2>
        {viewAllHref && books.length > 0 && (
          <Link
            href={viewAllHref}
            className={cn(
              "flex items-center gap-1 text-sm font-medium",
              "text-primary hover:text-primary/80",
              "transition-colors"
            )}
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Books List */}
      {books.length > 0 ? (
        <div
          className={cn(
            "flex gap-4 overflow-x-auto pb-4",
            "snap-x snap-mandatory",
            "scrollbar-hide",
            "-mx-6 px-6 sm:-mx-10 sm:px-10 lg:-mx-16 lg:px-16" // Extend to edges with padding
          )}
        >
          {books.map((book, index) => {
            const progress = progressByBookId?.[book.id];
            return (
              <div key={book.id} className="snap-start flex-shrink-0 w-36">
                <BookCard
                  book={{
                    id: book.id,
                    title: book.title,
                    author: book.author,
                    slug: book.slug,
                    cover_url: book.cover_url,
                    google_books_id: book.google_books_id,
                    isbn: book.isbn,
                    open_library_cover_id: book.open_library_cover_id,
                    average_rating: book.average_rating,
                  }}
                  size="md"
                  priority={index < 3}
                />
                {progress && (
                  <ReadingProgressCard
                    bookId={book.id}
                    bookTitle={book.title}
                    currentPage={progress.currentPage}
                    totalPages={progress.totalPages}
                    percent={progress.percent}
                    pageCount={book.page_count}
                    variant="compact"
                    className="mt-2"
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title={emptyTitle}
          description={emptyMessage}
          action={emptyAction}
        />
      )}
    </section>
  );
}

