import type { Metadata } from "next";
import { getPopularBooks } from "@/lib/queries/books";
import { BookBrowser } from "@/components/books/book-browser";

export const metadata: Metadata = {
  title: "Browse Books",
  description:
    "Discover your next favorite book. Browse our collection, read reviews, and track your reading journey.",
};

const genres = [
  "Fiction",
  "Non-Fiction",
  "Fantasy",
  "Science Fiction",
  "Mystery",
  "Romance",
  "Biography",
  "Self-Help",
  "History",
  "Horror",
  "Thriller",
  "Literary Fiction",
];

export default async function BrowseBooksPage() {
  // Fetch initial popular books on server
  const initialBooks = await getPopularBooks(20);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-serif mb-2">Browse Books</h1>
        <p className="text-muted-foreground">
          Discover your next favorite read
        </p>
      </div>

      {/* Client-side browser component */}
      <BookBrowser initialBooks={initialBooks} genres={genres} />
    </div>
  );
}
