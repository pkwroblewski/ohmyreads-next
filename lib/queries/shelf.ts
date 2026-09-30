import { unstable_cache } from "next/cache";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { STAFF_PICK_SLUGS, inStaffOrder } from "@/lib/curated-picks";
import type { ShelfBook } from "@/components/shelf/shelf";
import type { BookCoverData } from "@/lib/utils/covers";
import { logError } from "@/lib/utils/log";

export interface ShelfYear {
  /** null: read books with no finish date (imported without "Date Read"). */
  year: number | null;
  books: ShelfBook[];
  pages: number;
}

export type FaceOutBook = BookCoverData & {
  id: string;
  slug: string;
  title: string;
  author: string;
};

export interface CurrentBook extends FaceOutBook {
  pageCount: number | null;
  currentPage: number | null;
  progress: number | null;
}

export interface ProfileShelf {
  years: ShelfYear[];
  reading: CurrentBook[];
  want: FaceOutBook[];
}

const COLUMNS =
  "id, status, finished_at, current_page, progress_percentage, book:books(id, slug, title, author, page_count, genres, spine_color, spine_ink, cover_url, isbn, google_books_id, open_library_cover_id)";
const PAGE = 1000; // PostgREST's default row cap
const MAX_ROWS = 10000;
const WANT_LIMIT = 12;

/**
 * A reader's bookcase: read books grouped into one shelf per year of
 * `finished_at`, newest year first and oldest book first within a year,
 * then one undated shelf (the app always sets `finished_at`, so a missing
 * one means an import without "Date Read"; guessing a year would pile a
 * whole back catalogue into the import year); plus what they are reading now and the
 * most recent want-to-read books. Uses the session client, so RLS
 * (migration 056) returns nothing for an opted-out reader viewed by others.
 */
export async function getProfileShelf(userId: string): Promise<ProfileShelf> {
  const supabase = await createClient();

  type Row = {
    id: string;
    status: string;
    finished_at: string | null;
    current_page: number | null;
    progress_percentage: number | null;
    book: {
      id: string;
      slug: string;
      title: string;
      author: string;
      page_count: number | null;
      genres: string[] | null;
      spine_color: string | null;
      spine_ink: string | null;
      cover_url: string | null;
      isbn: string | null;
      google_books_id: string | null;
      open_library_cover_id: number | null;
    } | null;
  };

  const rows: Row[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabase
      .from("user_books")
      .select(COLUMNS)
      .eq("user_id", userId)
      .in("status", ["read", "reading", "want_to_read"])
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)
      .overrideTypes<Row[], { merge: false }>();
    if (error) {
      logError("Error fetching profile shelf", error);
      break;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const byYear = new Map<number, ShelfBook[]>();
  const undated: ShelfBook[] = [];
  const reading: CurrentBook[] = [];
  const want: FaceOutBook[] = [];

  for (const row of rows) {
    const b = row.book;
    if (!b) continue;
    const face: FaceOutBook = {
      id: b.id,
      slug: b.slug,
      title: b.title,
      author: b.author,
      cover_url: b.cover_url,
      isbn: b.isbn,
      google_books_id: b.google_books_id,
      open_library_cover_id: b.open_library_cover_id,
    };
    if (row.status === "reading") {
      reading.push({
        ...face,
        pageCount: b.page_count,
        currentPage: row.current_page,
        progress: row.progress_percentage,
      });
    } else if (row.status === "want_to_read") {
      if (want.length < WANT_LIMIT) want.push(face);
    } else {
      const book: ShelfBook = {
        id: row.id,
        slug: b.slug,
        title: b.title,
        author: b.author,
        pageCount: b.page_count,
        genre: b.genres?.[0] ?? null,
        spineColor: b.spine_color,
        spineInk: b.spine_ink,
        finishedAt: row.finished_at,
      };
      if (!row.finished_at) {
        undated.push(book);
        continue;
      }
      const year = Number(row.finished_at.slice(0, 4));
      const list = byYear.get(year) ?? [];
      list.push(book);
      byYear.set(year, list);
    }
  }

  const pages = (books: ShelfBook[]) => books.reduce((sum, bk) => sum + (bk.pageCount ?? 0), 0);
  const years: ShelfYear[] = [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, books]) => {
      books.sort((x, y) => x.finishedAt!.localeCompare(y.finishedAt!));
      return { year, books, pages: pages(books) };
    });
  if (undated.length > 0) years.push({ year: null, books: undated, pages: pages(undated) });

  return { years, reading, want };
}

/**
 * The homepage's staff shelf (`lib/curated-picks.ts`) as spines. The same
 * for every visitor, so cached on the public client until a book changes.
 */
export const getStaffShelf = unstable_cache(
  async (): Promise<ShelfBook[]> => {
    const { data, error } = await createPublicClient()
      .from("books")
      .select("id, slug, title, author, page_count, genres, spine_color, spine_ink")
      .in("slug", STAFF_PICK_SLUGS);
    if (error) {
      logError("Error fetching staff shelf", error);
      return [];
    }
    return inStaffOrder(data ?? []).map((b) => ({
      id: b.id,
      slug: b.slug,
      title: b.title,
      author: b.author,
      pageCount: b.page_count,
      genre: b.genres?.[0] ?? null,
      spineColor: b.spine_color,
      spineInk: b.spine_ink,
    }));
  },
  ["staff-shelf"],
  { revalidate: 3600, tags: [CACHE_TAGS.books] }
);

export interface YearShelf {
  username: string;
  name: string;
  books: ShelfBook[];
  pages: number;
}

/**
 * One year of a reader's shelf for the share image, oldest book first.
 * Public client only: the image is cached on the CDN, so an owner's own
 * session must never widen what it shows. Null for an unknown, disabled or
 * opted-out reader (migration 056 would return their books as empty anyway;
 * the explicit check turns that into a 404 instead of an empty shelf).
 */
export async function getYearShelf(username: string, year: number): Promise<YearShelf | null> {
  const supabase = createPublicClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, discovery_visible")
    .eq("username", username)
    .is("disabled_at", null)
    .maybeSingle();
  if (profileError) logError("Error fetching share profile", profileError);
  if (!profile || profile.discovery_visible === false) return null;

  type Row = {
    id: string;
    finished_at: string;
    book: {
      slug: string;
      title: string;
      author: string;
      page_count: number | null;
      genres: string[] | null;
      spine_color: string | null;
      spine_ink: string | null;
    } | null;
  };
  const { data, error } = await supabase
    .from("user_books")
    .select("id, finished_at, book:books(slug, title, author, page_count, genres, spine_color, spine_ink)")
    .eq("user_id", profile.id)
    .eq("status", "read")
    .gte("finished_at", `${year}-01-01`)
    .lt("finished_at", `${year + 1}-01-01`)
    .order("finished_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1000)
    .overrideTypes<Row[], { merge: false }>();
  if (error) {
    logError("Error fetching year shelf", error);
    return null;
  }

  const books: ShelfBook[] = (data ?? []).flatMap((row) =>
    row.book
      ? [
          {
            id: row.id,
            slug: row.book.slug,
            title: row.book.title,
            author: row.book.author,
            pageCount: row.book.page_count,
            genre: row.book.genres?.[0] ?? null,
            spineColor: row.book.spine_color,
            spineInk: row.book.spine_ink,
            finishedAt: row.finished_at,
          },
        ]
      : []
  );
  return {
    username: profile.username,
    name: profile.display_name || profile.username,
    books,
    pages: books.reduce((sum, b) => sum + (b.pageCount ?? 0), 0),
  };
}
