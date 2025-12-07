import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { BookCard } from "./book-card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Book } from "@/types/database";

interface BookListHorizontalProps {
  title: string;
  books: Book[];
  emptyMessage?: string;
  viewAllHref?: string;
}

export function BookListHorizontal({
  title,
  books,
  emptyMessage = "No books to display",
  viewAllHref,
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
            "-mx-4 px-4" // Extend to edges with padding
          )}
        >
          {books.map((book) => (
            <div key={book.id} className="snap-start flex-shrink-0">
              <BookCard
                book={{
                  id: book.id,
                  title: book.title,
                  author: book.author,
                  slug: book.slug,
                  cover_url: book.cover_url,
                  average_rating: book.average_rating,
                }}
                size="md"
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="Nothing here yet"
          description={emptyMessage}
        />
      )}
    </section>
  );
}

