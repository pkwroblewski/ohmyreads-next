import type { Metadata } from "next";
import { getPopularBooks, getAllGenres, getBookCount, searchBooks } from "@/lib/queries/books";
import { parseBrowseParams } from "@/lib/validation/search";
import { getShelfStatuses } from "@/lib/queries/users";
import { getUser } from "@/lib/supabase/server";
import { BookBrowser } from "@/components/books/book-browser";

interface Props {
  searchParams: Promise<{ q?: string; genre?: string; sort?: string }>;
}

const PAGE_SIZE = 20;

const BASE_TITLE = "Browse Books - Find Your Next Great Read";
const BASE_DESCRIPTION =
  "Discover your next favorite book from thousands of titles. Browse by genre, read authentic reviews from readers like you, and add books to your personal shelf on OhMyReads.";

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

async function resolveGenres(): Promise<string[]> {
  const dbGenres = await getAllGenres();
  return dbGenres.length > 0 ? dbGenres : FALLBACK_GENRES;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [raw, genres] = await Promise.all([searchParams, resolveGenres()]);
  const { genre } = parseBrowseParams(raw, genres);

  // Search results and sort orders are views of the same list, so they point
  // at the bare URL; a genre is its own page.
  if (!genre) {
    return {
      title: BASE_TITLE,
      description: BASE_DESCRIPTION,
      alternates: { canonical: "/books" },
      openGraph: {
        title: BASE_TITLE,
        description:
          "Discover your next favorite book from thousands of titles. Browse by genre, read authentic reviews, and track your reading journey.",
      },
    };
  }

  const title = `${genre} Books`;
  const description = `Browse ${genre} books on OhMyReads. Read reviews from real readers, find your next ${genre.toLowerCase()} read, and add it to your shelf.`;
  return {
    title,
    description,
    alternates: { canonical: `/books?genre=${encodeURIComponent(genre)}` },
    openGraph: { title, description },
  };
}

export default async function BrowseBooksPage({ searchParams }: Props) {
  const [raw, genres] = await Promise.all([searchParams, resolveGenres()]);
  const { q, genre, sort } = parseBrowseParams(raw, genres);

  // The default view is the cached popular list; any filter runs the same
  // query the client island would otherwise fetch after hydration, so a
  // genre link (or the sitelinks search box) lands on the filtered HTML.
  const filtered = q !== "" || genre !== null || sort !== "popular";
  const initial = filtered
    ? await searchBooks(q, { genre: genre ?? undefined, sort, limit: PAGE_SIZE })
    : await Promise.all([getPopularBooks(PAGE_SIZE), getBookCount()]).then(
        ([books, total]) => ({ books, total })
      );

  // The book list itself stays cached and identical for everyone; only the
  // shelf labels are per-viewer, so they are read here rather than after
  // hydration — a reload must not flash "Add to Shelf" on a shelved book.
  const {
    data: { user },
  } = await getUser();
  const shelfStatuses = user
    ? await getShelfStatuses(
        user.id,
        initial.books.map((book) => book.id)
      )
    : {};

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-serif mb-2">
          {genre ? `${genre} Books` : "Browse Books"}
        </h1>
        <p className="text-muted-foreground">
          Discover your next favorite read
        </p>
      </div>

      {/* Client-side browser component */}
      <BookBrowser
        initialBooks={initial.books}
        initialTotal={initial.total}
        initialQuery={q}
        initialGenre={genre}
        initialSort={sort}
        initialShelfStatuses={shelfStatuses}
        genres={genres}
      />
    </div>
  );
}
