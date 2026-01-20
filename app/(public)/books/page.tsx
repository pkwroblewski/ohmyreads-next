import type { Metadata } from "next";
import { getPopularBooks, getAllGenres } from "@/lib/queries/books";
import { BookBrowser } from "@/components/books/book-browser";

export const metadata: Metadata = {
  title: "Browse Books - Find Your Next Great Read",
  description:
    "Discover your next favorite book from thousands of titles. Browse by genre, read authentic reviews from readers like you, and add books to your personal shelf on OhMyReads.",
  openGraph: {
    title: "Browse Books - Find Your Next Great Read",
    description: "Discover your next favorite book from thousands of titles. Browse by genre, read authentic reviews, and track your reading journey.",
  },
};

// Fallback genres if database returns empty
const FALLBACK_GENRES = [
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
  // Fetch initial data in parallel
  const [initialBooks, dbGenres] = await Promise.all([
    getPopularBooks(20),
    getAllGenres(),
  ]);

  // Use DB genres if available, otherwise fall back to defaults
  const genres = dbGenres.length > 0 ? dbGenres : FALLBACK_GENRES;

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

