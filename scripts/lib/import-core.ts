/**
 * Shared machinery for the catalog import scripts (catalog launch, Tasks 4-5).
 *
 * A script turns its source (NYT lists, Open Library subjects, award
 * subjects) into `ImportCandidate`s; this module deduplicates them against
 * the catalog, enriches from Open Library (and Google Books when a key
 * exists), inserts through the shared slug-safe helper and runs the cover
 * pipeline. Scripts are exempt from the `no-console` rule, so progress and
 * the summary are printed here.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { processBook, type ProcessResult } from "../../lib/covers/pipeline";
import { insertBookWithUniqueSlug, type BookInsertData } from "../../lib/import/insert-book";
import { normalizeGenres } from "../../lib/data/genres";
import {
  getOpenLibraryDescription,
  normalizeAuthor,
  normalizeTitle,
  searchGoogleBooksByIsbn,
  searchOpenLibrary,
  searchOpenLibraryByIsbn,
  type ExternalBookResult,
} from "../../lib/utils/external-book-search";
import { generateSlug } from "../../lib/utils/slug";
import type { Database } from "../../types/database";

// ============================================
// CONFIGURATION
// ============================================

export const DEFAULT_CONCURRENCY = 5; // ~5 sequential requests per book over 10-20 s: under OL's 2 req/s
export const DEFAULT_DELAY_MS = 500;
const GOOGLE_DAILY_BUDGET = 900;
const MAX_GENRES = 8;
const PAGE_SIZE = 1000;

// Open Library subjects that describe the record, not the book
// ============================================
// TYPES
// ============================================

export interface ImportCandidate {
  /** Display title, already cased */
  title: string;
  author: string;
  isbn: string | null;
  description?: string | null;
  /** Curated genres in display order (list genres, award tags, "Bestseller"…) */
  genres: string[];
  /** Raw Open Library subjects; filtered into genres after the curated ones */
  subjects?: string[];
  /** Extra cover candidates tried first by the pipeline (e.g. NYT's image) */
  coverUrls?: string[];
  openLibraryId?: string | null;
  openLibraryCoverId?: number | null;
  publishedDate?: string | null;
  pageCount?: number | null;
}

export interface CatalogIndex {
  isbns: Map<string, string>;
  titleAuthors: Map<string, string>;
  /** `books.open_library_id` is unique: a known work under another title is a duplicate */
  openLibraryIds: Map<string, string>;
}

export type DuplicateReason = "isbn" | "title-author" | "open-library-id" | "enriched-title";

export type Outcome =
  | { kind: "inserted"; id: string; slug: string; cover: ProcessResult }
  | { kind: "duplicate"; reason: DuplicateReason; existingId: string }
  | { kind: "insert-failed"; error: string };

export interface RunStats {
  inserted: number;
  duplicate: number;
  insertFailed: number;
  coverStored: number;
  coverNone: number;
  coverFailed: number;
  coverSource: Record<string, number>;
  failures: string[];
  noCover: string[];
  /** Duplicates found only after enrichment, with the existing row id (awards tag these) */
  duplicates: Array<{ candidate: ImportCandidate; reason: DuplicateReason; existingId: string }>;
}

export interface RunOptions {
  concurrency?: number;
  delayMs?: number;
  verbose?: boolean;
  /** Called after each inserted or duplicate outcome (e.g. to tag an existing row) */
  onOutcome?: (candidate: ImportCandidate, outcome: Outcome) => Promise<void>;
}

// ============================================
// HELPERS
// ============================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatProgress(current: number, total: number): string {
  const percent = Math.round((current / total) * 100);
  const bar =
    "█".repeat(Math.floor(percent / 5)) + "░".repeat(20 - Math.floor(percent / 5));
  return `[${bar}] ${percent}% (${current}/${total})`;
}

// Author spaces dropped too: "A.J. Finn" and "A. J. Finn" must collide.
export function titleAuthorKey(title: string, author: string): string {
  return `${normalizeTitle(title)}|${normalizeAuthor(author).replace(/\s+/g, "")}`;
}

/** Same title ignoring case, punctuation, a leading article and a subtitle. */
export function titlesAgree(a: string, b: string): boolean {
  const strip = (t: string) => normalizeTitle(t).replace(/^(the|a|an) /, "");
  const x = strip(a);
  const y = strip(b);
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
}

export function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = v.toLowerCase();
    if (!v || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============================================
// CLIENT + CATALOG INDEX
// ============================================

export function createServiceClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function loadCatalogIndex(supabase: SupabaseClient<Database>): Promise<CatalogIndex> {
  const index: CatalogIndex = { isbns: new Map(), titleAuthors: new Map(), openLibraryIds: new Map() };
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("books")
      .select("id, isbn, title, author, open_library_id")
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to load catalog: ${error.message}`);
    for (const row of data ?? []) {
      if (row.isbn) index.isbns.set(row.isbn.replace(/[^0-9Xx]/g, ""), row.id);
      index.titleAuthors.set(titleAuthorKey(row.title, row.author ?? ""), row.id);
      if (row.open_library_id) index.openLibraryIds.set(row.open_library_id, row.id);
    }
    if (!data || data.length < PAGE_SIZE) break;
  }
  return index;
}

/** The catalog row a candidate already matches, if any. */
export function findExisting(
  index: CatalogIndex,
  c: Pick<ImportCandidate, "title" | "author" | "isbn" | "openLibraryId">
): { id: string; reason: DuplicateReason } | null {
  const byIsbn = c.isbn ? index.isbns.get(c.isbn) : undefined;
  if (byIsbn) return { id: byIsbn, reason: "isbn" };
  const byTitle = index.titleAuthors.get(titleAuthorKey(c.title, c.author));
  if (byTitle) return { id: byTitle, reason: "title-author" };
  const byWork = c.openLibraryId ? index.openLibraryIds.get(c.openLibraryId) : undefined;
  if (byWork) return { id: byWork, reason: "open-library-id" };
  return null;
}

function remember(index: CatalogIndex, id: string, c: ImportCandidate, insert: BookInsertData) {
  if (c.isbn) index.isbns.set(c.isbn, id);
  index.titleAuthors.set(titleAuthorKey(c.title, c.author), id);
  index.titleAuthors.set(titleAuthorKey(insert.title, insert.author), id);
  if (insert.open_library_id) index.openLibraryIds.set(insert.open_library_id, id);
}

// ============================================
// ENRICHMENT
// ============================================

let googleCallsUsed = 0;
const googleEnabled = Boolean(process.env.GOOGLE_BOOKS_API_KEY);

export function googleStatus(): string {
  return googleEnabled ? `keyed, budget ${GOOGLE_DAILY_BUDGET}, used ${googleCallsUsed}` : "off (no key)";
}

interface Enrichment {
  openLibrary: ExternalBookResult | null;
  google: ExternalBookResult | null;
  /** Description fetched by work id when the candidate already knows its work */
  description: string | null;
}

function authorMatches(candidate: string, found: string): boolean {
  const a = normalizeAuthor(candidate).split(" ");
  const b = normalizeAuthor(found);
  const surname = a[a.length - 1];
  return surname.length > 2 && b.includes(surname);
}

/**
 * A candidate that already names its Open Library work only needs the
 * description. Otherwise: Open Library by ISBN (an ISBN hit whose title
 * disagrees with the source's is a mis-attached edition and is discarded),
 * then a title+author search restricted to an exact normalised title and a
 * surname match. Google Books only with a key and while the daily budget lasts.
 */
async function enrichCandidate(c: ImportCandidate, verbose: boolean): Promise<Enrichment> {
  let openLibrary: ExternalBookResult | null = null;
  let description: string | null = null;
  if (c.openLibraryId) {
    description = c.description ?? (await getOpenLibraryDescription(c.openLibraryId));
  } else {
    if (c.isbn) openLibrary = await searchOpenLibraryByIsbn(c.isbn);
    if (openLibrary && !titlesAgree(openLibrary.title, c.title)) {
      if (verbose) console.log(`   ? ISBN ${c.isbn} is "${openLibrary.title}" on Open Library, not "${c.title}"; ignoring`);
      openLibrary = null;
    }
    if (!openLibrary) {
      const results = await searchOpenLibrary(`${c.title} ${c.author}`, 5);
      const match = results.find(
        (r) => normalizeTitle(r.title) === normalizeTitle(c.title) && authorMatches(c.author, r.author)
      );
      if (match) {
        openLibrary = {
          ...match,
          isbn: c.isbn ?? match.isbn,
          description: match.openLibraryId ? await getOpenLibraryDescription(match.openLibraryId) : null,
        };
      }
    }
  }
  let google: ExternalBookResult | null = null;
  if (googleEnabled && c.isbn && googleCallsUsed < GOOGLE_DAILY_BUDGET) {
    googleCallsUsed++;
    google = await searchGoogleBooksByIsbn(c.isbn);
  }
  return { openLibrary, google, description };
}

function buildInsert(c: ImportCandidate, { openLibrary, google, description }: Enrichment): BookInsertData {
  // Curated genres first, then whatever Open Library subjects map onto the
  // vocabulary (lib/data/genres.ts); everything else is dropped.
  const subjects = c.subjects ?? openLibrary?.genres ?? [];
  const genres = normalizeGenres([...c.genres, ...subjects]).slice(0, MAX_GENRES);
  return {
    // The source names the book; Open Library titles are sentence case and
    // may drop the article ("Widow"), Google's may carry a subtitle.
    title: c.title,
    author: c.author,
    description: description || openLibrary?.description || google?.description || c.description || null,
    cover_url: null,
    cover_source: null,
    isbn: c.isbn ?? openLibrary?.isbn ?? null,
    google_books_id: google?.googleBooksId ?? null,
    open_library_id: c.openLibraryId ?? openLibrary?.openLibraryId ?? null,
    open_library_cover_id: c.openLibraryCoverId ?? openLibrary?.openLibraryCoverId ?? null,
    genres,
    page_count: c.pageCount ?? openLibrary?.pageCount ?? google?.pageCount ?? null,
    // Google carries a full date; Open Library only the first-publish year
    published_date: google?.publishedDate ?? c.publishedDate ?? openLibrary?.publishedDate ?? null,
    // Ratings are Open Library's, imported later by `import-ratings`
    average_rating: null,
    ratings_count: 0,
    local_average_rating: null,
    local_ratings_count: 0,
  };
}

// ============================================
// IMPORT ONE CANDIDATE
// ============================================

export async function importCandidate(
  supabase: SupabaseClient<Database>,
  c: ImportCandidate,
  index: CatalogIndex,
  verbose = false
): Promise<Outcome> {
  const existing = findExisting(index, c);
  if (existing) return { kind: "duplicate", reason: existing.reason, existingId: existing.id };

  const enrichment = await enrichCandidate(c, verbose);
  const insert = buildInsert(c, enrichment);
  const late = findExisting(index, {
    title: insert.title,
    author: insert.author,
    isbn: insert.isbn ?? null,
    openLibraryId: insert.open_library_id,
  });
  if (late) return { kind: "duplicate", reason: late.reason === "title-author" ? "enriched-title" : late.reason, existingId: late.id };

  const result = await insertBookWithUniqueSlug(supabase, insert, generateSlug(insert.title));
  if (!result.success) return { kind: "insert-failed", error: result.error };
  remember(index, result.id, c, insert);

  const cover = await processBook(
    supabase,
    {
      id: result.id,
      cover_url: null,
      isbn: insert.isbn,
      google_books_id: insert.google_books_id,
      open_library_cover_id: insert.open_library_cover_id,
    },
    { extraUrls: c.coverUrls ?? [] }
  );
  return { kind: "inserted", id: result.id, slug: result.slug, cover };
}

// ============================================
// QUEUE RUNNER
// ============================================

export async function runQueue(
  supabase: SupabaseClient<Database>,
  queue: ImportCandidate[],
  index: CatalogIndex,
  opts: RunOptions = {}
): Promise<RunStats> {
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  const delayMs = opts.delayMs ?? DEFAULT_DELAY_MS;
  const verbose = opts.verbose ?? false;
  const stats: RunStats = {
    inserted: 0,
    duplicate: 0,
    insertFailed: 0,
    coverStored: 0,
    coverNone: 0,
    coverFailed: 0,
    coverSource: { google: 0, openlibrary: 0, other: 0 },
    failures: [],
    noCover: [],
    duplicates: [],
  };

  console.log(`🔄 Importing ${queue.length} titles (${concurrency} workers, ${delayMs} ms between books)...`);
  console.log(`   (Estimated time: ~${Math.ceil((queue.length * 13) / concurrency / 60)} minutes)\n`);

  let done = 0;
  const runOne = async (c: ImportCandidate) => {
    const label = `${c.title} — ${c.author}`;
    try {
      const outcome = await importCandidate(supabase, c, index, verbose);
      if (outcome.kind === "inserted") {
        stats.inserted++;
        const { cover } = outcome;
        if (cover.status === "stored") {
          stats.coverStored++;
          stats.coverSource[cover.source] = (stats.coverSource[cover.source] ?? 0) + 1;
        } else if (cover.status === "failed") {
          stats.coverFailed++;
          stats.failures.push(`${label}: cover ${cover.error}`);
        } else {
          stats.coverNone++;
          stats.noCover.push(`${label} (${outcome.slug})`);
        }
        if (verbose) {
          const coverNote =
            cover.status === "stored" ? `cover ${cover.width}×${cover.height} ${cover.source}` : `cover ${cover.status}`;
          console.log(`   ✓ ${label} → /books/${outcome.slug} (${coverNote})`);
        }
      } else if (outcome.kind === "duplicate") {
        stats.duplicate++;
        stats.duplicates.push({ candidate: c, reason: outcome.reason, existingId: outcome.existingId });
        if (verbose) console.log(`   = ${label} (duplicate by ${outcome.reason})`);
      } else {
        stats.insertFailed++;
        stats.failures.push(`${label}: ${outcome.error}`);
        console.log(`   ✗ ${label}: ${outcome.error}`);
      }
      if (opts.onOutcome && outcome.kind !== "insert-failed") await opts.onOutcome(c, outcome);
    } catch (error) {
      stats.insertFailed++;
      const message = error instanceof Error ? error.message : String(error);
      stats.failures.push(`${label}: ${message}`);
      console.log(`   ✗ ${label}: ${message}`);
    }
    done++;
    if (done % 25 === 0 || done === queue.length) {
      console.log(`   ${formatProgress(done, queue.length)} inserted ${stats.inserted}`);
    }
    await sleep(delayMs);
  };

  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (cursor < queue.length) {
        const c = queue[cursor++];
        await runOne(c);
      }
    })
  );
  return stats;
}

export function printSummary(stats: RunStats, extra: string[] = []): void {
  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary");
  console.log(`   Inserted:            ${stats.inserted}`);
  console.log(`   Duplicates (late):   ${stats.duplicate}`);
  console.log(`   Insert failed:       ${stats.insertFailed}`);
  console.log(
    `   Covers stored:       ${stats.coverStored} (google ${stats.coverSource.google}, openlibrary ${stats.coverSource.openlibrary}, other ${stats.coverSource.other})`
  );
  console.log(`   Covers none:         ${stats.coverNone}`);
  console.log(`   Covers failed:       ${stats.coverFailed}`);
  for (const line of extra) console.log(`   ${line}`);
  console.log(`   Google Books:        ${googleStatus()}`);
  if (stats.noCover.length > 0) {
    console.log(`\n🖼️  No cover candidate passed (${stats.noCover.length}):`);
    for (const line of stats.noCover) console.log(`   - ${line}`);
  }
  if (stats.failures.length > 0) {
    console.log(`\n⚠️  Failures (${stats.failures.length}):`);
    for (const line of stats.failures) console.log(`   - ${line}`);
  }
}
