/**
 * Cover Backfill Script (Catalog launch, Task 3)
 *
 * Runs the server-side cover pipeline (`lib/covers/pipeline.ts`) over the
 * catalog: downloads every candidate cover, rejects placeholders and small
 * images, keeps the sharpest, stores one JPEG per book in the public
 * `book-covers` bucket and points `cover_url` at it.
 *
 * Usage:
 *   npm run covers:process                     # every book not yet on the bucket
 *   npm run covers:process -- --dry-run        # fetch + score, no upload/update
 *   npm run covers:process -- --limit 50       # stop after 50 attempted books
 *   npm run covers:process -- --force          # re-process books already on the bucket
 *   npm run covers:process -- --only-missing   # only books with no cover_url at all
 *   npm run covers:process -- --ids a,b,c      # only these book ids (implies --force)
 *   npm run covers:process -- --source openlibrary --force
 *                                              # only rows whose stored cover came from
 *                                              # that source (openlibrary|google|other);
 *                                              # they are on the bucket, so pair with --force
 *   npm run covers:process -- --source other --force --keep-existing
 *                                              # replacement pass: a row whose candidates all
 *                                              # fail keeps its stored cover (listed at the end)
 *                                              # instead of being cleared
 *   npm run covers:process -- --source openlibrary --force --skip-newer-than 1788757900
 *                                              # resume: skip rows whose stored cover already
 *                                              # carries a ?v= stamp at/after that unix time
 *                                              # (the start of the interrupted run)
 *   npm run covers:process -- --verbose        # per-candidate verdicts
 *
 * Environment:
 *   Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Rate limits: Open Library asks for <= 2 req/s. Each book fetches at most a
 * handful of candidates sequentially, then sleeps 500 ms.
 *
 * Second pass: when no candidate passes (typically a small Open Library scan
 * of the row's own ISBN plus Google placeholders), the script asks the Open
 * Library search API for the work-level `cover_i` and retries with it. That
 * cover belongs to whichever edition Open Library chose for the work, so it
 * is only used as a last resort, never to replace a passing candidate.
 *
 * Third pass (needs GOOGLE_BOOKS_API_KEY; `--no-google` disables it): when a
 * book with an ISBN and no `google_books_id` still has no candidate, look the
 * ISBN up on Google Books and retry with its zoom-3 cover; the pipeline still
 * rejects Google's grey placeholder by hash. A hit persists `google_books_id`.
 * Capped at 950 lookups per run (the key's quota is 1,000/day).
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
  isStoredCover,
  processBook,
  type ProcessResult,
} from "../lib/covers/pipeline";
import { getGoogleBooksCoverUrl, getOpenLibraryCoverById } from "../lib/utils/covers";
import { searchGoogleBooksByIsbn } from "../lib/utils/external-book-search";
import type { Database } from "../types/database";

// Load environment variables
config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ============================================
// CONFIGURATION
// ============================================

const BOOK_DELAY_MS = 500; // Sleep between books (Open Library politeness)
const OL_SEARCH_URL = "https://openlibrary.org/search.json";
const USER_AGENT = "OhMyReads/1.0 (https://ohmyreads-next.vercel.app; cover backfill)";
const PAGE_SIZE = 200; // Rows per DB page

// ============================================
// CLI ARGUMENTS
// ============================================

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isVerbose = args.includes("--verbose");
const isForce = args.includes("--force");
const onlyMissing = args.includes("--only-missing");
const keepExisting = args.includes("--keep-existing");
const noGoogle = args.includes("--no-google");
const googleEnabled = !noGoogle && !!process.env.GOOGLE_BOOKS_API_KEY?.trim();
const GOOGLE_LOOKUP_BUDGET = 950; // the key's quota is 1,000/day
let googleLookups = 0;
let googleBudgetHit = false;

const sourceIndex = args.indexOf("--source");
const onlySource =
  sourceIndex !== -1 && args[sourceIndex + 1] ? args[sourceIndex + 1].trim() : null;
if (onlySource && !["openlibrary", "google", "other"].includes(onlySource)) {
  console.error(`Unknown --source "${onlySource}". Use openlibrary, google or other.`);
  process.exit(1);
}

const skipIndex = args.indexOf("--skip-newer-than");
const skipNewerThan =
  skipIndex !== -1 && args[skipIndex + 1] ? parseInt(args[skipIndex + 1], 10) : null;
if (skipNewerThan !== null && !Number.isFinite(skipNewerThan)) {
  console.error("--skip-newer-than expects unix seconds, e.g. 1788757900");
  process.exit(1);
}

/** The `?v=` stamp `storeCover()` appends (unix seconds), if the row has one. */
function coverVersion(coverUrl: string | null): number | null {
  const match = coverUrl ? /[?&]v=(\d+)/.exec(coverUrl) : null;
  return match ? Number(match[1]) : null;
}

const idsIndex = args.indexOf("--ids");
const onlyIds =
  idsIndex !== -1 && args[idsIndex + 1]
    ? args[idsIndex + 1].split(",").map((s) => s.trim()).filter(Boolean)
    : null;

const limitIndex = args.indexOf("--limit");
const limit =
  limitIndex !== -1 && args[limitIndex + 1]
    ? parseInt(args[limitIndex + 1], 10)
    : Infinity;

// ============================================
// TYPES
// ============================================

interface BookRow {
  id: string;
  title: string;
  author: string;
  slug: string;
  cover_url: string | null;
  isbn: string | null;
  google_books_id: string | null;
  open_library_cover_id: number | null;
}

interface Outcome {
  book: BookRow;
  result: ProcessResult;
}

// ============================================
// HELPERS
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatProgress(current: number, total: number): string {
  const percent = Math.round((current / total) * 100);
  const bar =
    "█".repeat(Math.floor(percent / 5)) + "░".repeat(20 - Math.floor(percent / 5));
  return `[${bar}] ${percent}% (${current}/${total})`;
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.slice(0, 70);
  } catch {
    return url.slice(0, 70);
  }
}

/**
 * Open Library's work-level cover id for a book, via the search API (ISBN
 * first, then title + author). Returns null when nothing new is found.
 */
async function discoverWorkCoverId(book: BookRow): Promise<number | null> {
  const queries: URLSearchParams[] = [];
  if (book.isbn) queries.push(new URLSearchParams({ q: `isbn:${book.isbn}` }));
  queries.push(new URLSearchParams({ title: book.title, author: book.author }));

  for (const params of queries) {
    params.set("fields", "cover_i");
    params.set("limit", "1");
    try {
      const res = await fetch(`${OL_SEARCH_URL}?${params}`, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { docs?: { cover_i?: number }[] };
      const coverId = json.docs?.[0]?.cover_i;
      if (coverId && coverId !== book.open_library_cover_id) return coverId;
    } catch {
      // Treat a search failure like "not found"; the book stays no-candidate.
    }
    await sleep(BOOK_DELAY_MS);
  }
  return null;
}

// ============================================
// DATABASE QUERIES
// ============================================

/**
 * Walk the catalog oldest-first and return the books this run should attempt.
 * Books already on the bucket are dropped here (unless --force) so `--limit`
 * counts attempted books, not rows read.
 */
async function fetchBooksToProcess(maxCount: number): Promise<BookRow[]> {
  const selected: BookRow[] = [];
  let from = 0;

  while (selected.length < maxCount) {
    let query = supabase
      .from("books")
      .select(
        "id, title, author, slug, cover_url, isbn, google_books_id, open_library_cover_id"
      )
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (onlyMissing) {
      query = query.is("cover_url", null);
    }
    if (onlyIds) {
      query = query.in("id", onlyIds);
    }
    if (onlySource) {
      query = query.eq("cover_source", onlySource);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to fetch books:", error.message);
      throw error;
    }
    if (!data || data.length === 0) break;

    for (const book of data) {
      if (!isForce && !onlyIds && isStoredCover(book.cover_url)) continue;
      if (skipNewerThan !== null && (coverVersion(book.cover_url) ?? 0) >= skipNewerThan) continue;
      selected.push(book);
      if (selected.length >= maxCount) break;
    }

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return selected;
}

// ============================================
// MAIN
// ============================================

async function run(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║          COVER BACKFILL - Verified, stored covers      ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  if (isDryRun) console.log("\n🔍 DRY RUN MODE - candidates are fetched and scored, nothing is written\n");
  if (isForce) console.log("\n♻️  FORCE - books already on the bucket are re-processed\n");
  if (onlyMissing) console.log("\n🕳️  ONLY MISSING - restricted to books with no cover_url\n");
  if (onlyIds) console.log(`
🎯 IDS - restricted to ${onlyIds.length} given book id(s), re-processed even if already stored
`);
  if (skipNewerThan !== null) console.log(`⏭️  RESUME - skipping rows whose stored cover is stamped v >= ${skipNewerThan}`);
  if (googleEnabled) console.log("🔎 GOOGLE - ISBN lookups enabled for books with no candidate (third pass)");
  if (keepExisting) console.log("🛡️  KEEP EXISTING - a forced run leaves a stored cover in place when nothing passes");
  if (onlySource) console.log(`🎯 SOURCE - restricted to rows with cover_source = ${onlySource}${isForce ? "" : " (they are already stored; add --force to re-process)"}`);

  const limitLabel = Number.isFinite(limit) ? String(limit) : "all";
  console.log(`\n📚 Selecting books (limit: ${limitLabel})...`);
  const books = await fetchBooksToProcess(limit);

  if (books.length === 0) {
    console.log("\n✅ Nothing to do: every selected book already has a stored cover.");
    return;
  }

  console.log(`   ${books.length} books to process`);
  console.log(
    `\n🔄 Processing (${BOOK_DELAY_MS}ms between books, ~${Math.ceil(
      (books.length * (BOOK_DELAY_MS + 2500)) / 60000
    )} min estimated)...\n`
  );

  const outcomes: Outcome[] = [];
  const counts = { stored: 0, skipped: 0, noCandidate: 0, failed: 0, secondPass: 0, googleRescue: 0 };
  const rejectionReasons: Record<string, number> = {};

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    process.stdout.write(
      `\r   ${formatProgress(i + 1, books.length)} - "${book.title.substring(0, 35)}"`
    );

    const opts = { force: isForce || !!onlyIds, dryRun: isDryRun, keepExisting };
    let result = await processBook(supabase, book, opts);
    let secondPassCoverId: number | null = null;

    if (result.status === "no-candidate") {
      secondPassCoverId = await discoverWorkCoverId(book);
      if (secondPassCoverId) {
        result = await processBook(supabase, book, {
          ...opts,
          extraUrls: [getOpenLibraryCoverById(secondPassCoverId, "L")],
        });
        if (result.status !== "no-candidate") counts.secondPass++;
      }
    }

    let googleRescueId: string | null = null;
    if (
      result.status === "no-candidate" &&
      googleEnabled &&
      book.isbn &&
      !book.google_books_id
    ) {
      if (googleLookups >= GOOGLE_LOOKUP_BUDGET) {
        googleBudgetHit = true;
      } else {
        googleLookups++;
        const found = await searchGoogleBooksByIsbn(book.isbn);
        if (found?.googleBooksId) {
          googleRescueId = found.googleBooksId;
          result = await processBook(supabase, book, {
            ...opts,
            extraUrls: [getGoogleBooksCoverUrl(googleRescueId, 3)],
          });
          if (result.status === "stored") {
            counts.googleRescue++;
            if (!isDryRun) {
              const { error } = await supabase
                .from("books")
                .update({ google_books_id: googleRescueId })
                .eq("id", book.id);
              if (error) console.log(`\n      could not save google_books_id: ${error.message}`);
            }
          }
        }
        await sleep(BOOK_DELAY_MS);
      }
    }
    outcomes.push({ book, result });

    switch (result.status) {
      case "stored":
        counts.stored++;
        break;
      case "skipped":
        counts.skipped++;
        break;
      case "no-candidate":
        counts.noCandidate++;
        break;
      case "failed":
        counts.failed++;
        break;
    }

    if (result.status !== "skipped") {
      for (const c of result.candidates) {
        if (!c.ok && c.reason) {
          rejectionReasons[c.reason] = (rejectionReasons[c.reason] || 0) + 1;
        }
      }
    }

    if (isVerbose && result.status !== "skipped") {
      if (secondPassCoverId) {
        console.log(`\n      second pass: Open Library work cover id ${secondPassCoverId}`);
      }
      if (googleRescueId) {
        console.log(`\n      third pass: Google Books id ${googleRescueId}`);
      }
      console.log(`\n      ${result.status}${
        result.status === "stored"
          ? ` ← ${result.source} ${result.width}×${result.height}`
          : result.status === "failed"
            ? `: ${result.error}`
            : ""
      }`);
      for (const c of result.candidates) {
        console.log(
          `        ${c.ok ? "✓" : "✗"} ${shortUrl(c.url)}${
            c.width ? ` ${c.width}×${c.height}` : ""
          }${c.reason ? ` (${c.reason})` : ""}`
        );
      }
    }

    if (i < books.length - 1) {
      await sleep(BOOK_DELAY_MS);
    }
  }

  // Summary
  console.log("\n\n╔════════════════════════════════════════════════════════╗");
  console.log("║                   BACKFILL COMPLETE                     ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  console.log(`\n   📊 Results:`);
  console.log(`   - Processed (stored): ${counts.stored}`);
  console.log(`   - ...of which rescued by the Open Library work cover: ${counts.secondPass}`);
  console.log(
    `   - ...of which rescued by Google Books (ISBN lookup): ${counts.googleRescue}${
      googleEnabled ? ` (${googleLookups} lookups)` : " (disabled: no GOOGLE_BOOKS_API_KEY or --no-google)"
    }`
  );
  if (googleBudgetHit) {
    console.log(`   ⚠️  Google lookup budget (${GOOGLE_LOOKUP_BUDGET}) reached; re-run tomorrow for the rest`);
  }
  console.log(`   - Skipped (already stored): ${counts.skipped}`);
  console.log(`   - No candidate passed: ${counts.noCandidate}`);
  console.log(`   - Failed: ${counts.failed}`);

  if (Object.keys(rejectionReasons).length > 0) {
    console.log(`\n   🚫 Rejected candidates by reason:`);
    for (const [reason, count] of Object.entries(rejectionReasons).sort(
      (a, b) => b[1] - a[1]
    )) {
      console.log(`   - ${reason}: ${count}`);
    }
  }

  const noCandidate = outcomes.filter((o) => o.result.status === "no-candidate");
  if (noCandidate.length > 0) {
    console.log(`\n   📝 No usable cover found (manual review):`);
    for (const { book, result } of noCandidate) {
      const cleared =
        result.status === "no-candidate" && result.cleared
          ? " [stored cover removed]"
          : result.status === "no-candidate" && result.kept
            ? " [stored cover kept: no passing replacement]"
            : "";
      console.log(`   - ${book.title} — ${book.author} (/books/${book.slug})${cleared}`);
    }
  }

  const failed = outcomes.filter((o) => o.result.status === "failed");
  if (failed.length > 0) {
    console.log(`\n   ⚠️  Failed:`);
    for (const { book, result } of failed) {
      console.log(
        `   - ${book.title}: ${result.status === "failed" ? result.error : ""}`
      );
    }
  }

  if (isDryRun) {
    console.log(`\n   🔍 DRY RUN - nothing was uploaded or updated.`);
    console.log(`      Run without --dry-run to apply.`);
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Backfill failed:", error);
    process.exit(1);
  });
