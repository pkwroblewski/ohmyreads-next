/**
 * NYT Bestseller Import (Catalog launch, Task 4)
 *
 * Pulls one bestseller-list snapshot per month from the NYT Books API,
 * deduplicates the entries against each other and against the catalog,
 * enriches each new title from Open Library (and Google Books when a key
 * exists), inserts it with the shared slug-safe helper, then runs the cover
 * pipeline (Open Library / Google only: the NYT `book_image` is never a
 * candidate, the NYT API terms forbid caching its content beyond 24 hours;
 * see .claude/plans/nyt-covers-2026-09.md).
 *
 * Usage:
 *   npm run import:nyt                              # 2016-01 → this month
 *   npm run import:nyt -- --dry-run                 # counts only, no writes
 *   npm run import:nyt -- --from 2026-01 --to 2026-06
 *   npm run import:nyt -- --limit 50                # stop after 50 new titles
 *   npm run import:nyt -- --lists hardcover-fiction,hardcover-nonfiction
 *   npm run import:nyt -- --min-weeks 1             # every title (default 4 weeks on a list)
 *   npm run import:nyt -- --verbose
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NYT_BOOKS_API_KEY
 *   (all in .env.local); GOOGLE_BOOKS_API_KEY optional.
 *
 * Resumable: titles whose ISBN, normalised title+author or Open Library work
 * already exist in the catalog are skipped, so a re-run continues where the
 * last one stopped. NYT responses are cached under
 * node_modules/.cache/ohmyreads/nyt so a re-run costs no API calls
 * (limits: 5/min, 500/day; 13 s between calls).
 */

import { config } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  cleanAuthor,
  fetchOverview,
  firstSundays,
  isBoxSet,
  listGenres,
  stripEditionSuffix,
  titleCase,
  type NytEntry,
} from "../lib/import/nyt";
import {
  createServiceClient,
  findExisting,
  googleStatus,
  loadCatalogIndex,
  printSummary,
  runQueue,
  sleep,
  titleAuthorKey,
  type ImportCandidate,
} from "./lib/import-core";

// Load environment variables
config({ path: ".env.local" });

const nytApiKey = process.env.NYT_BOOKS_API_KEY?.trim();
if (!nytApiKey) {
  console.error("Missing NYT_BOOKS_API_KEY (register at developer.nytimes.com)");
  process.exit(1);
}
const supabase = createServiceClient();

// ============================================
// CONFIGURATION
// ============================================

const NYT_DELAY_MS = 13_000; // 5 req/min
const DEFAULT_FROM = "2016-01";
const CACHE_DIR = join("node_modules", ".cache", "ohmyreads", "nyt");
const DEFAULT_MIN_WEEKS = 4;

// Lists skipped unless named with --lists: audio and e-book lists carry
// audio/e-book ISBNs (no Open Library edition, no print cover) and repeat the
// print lists; series-books names a series with a box-set ISBN.
const EXCLUDED_LISTS = /^audio-|^e-book-|-e-book$|^series-books$/;

// ============================================
// CLI ARGUMENTS
// ============================================

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isVerbose = args.includes("--verbose");

function argValue(flag: string): string | null {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

const from = argValue("--from") ?? DEFAULT_FROM;
const to = argValue("--to") ?? new Date().toISOString().slice(0, 7);
const limit = argValue("--limit") ? parseInt(argValue("--limit") as string, 10) : Infinity;
// Staying power: a title's best `weeks_on_list` across every snapshot. One-week
// entries are mostly publicity spikes; the default keeps titles that lasted.
// Monthly lists (mass-market, *-monthly, the 2016-17 topical lists) report 0,
// so they only come in with --min-weeks 0.
const minWeeks = argValue("--min-weeks") ? parseInt(argValue("--min-weeks") as string, 10) : DEFAULT_MIN_WEEKS;
const onlyLists = argValue("--lists")
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ============================================
// TYPES
// ============================================

/** One title after in-memory deduplication */
interface Candidate {
  isbn: string;
  title: string; // NYT title, edition suffix stripped, still ALL CAPS
  author: string; // cleaned
  description: string | null;
  lists: Set<string>;
  firstSeen: string;
  lastSeen: string;
  bestRank: number;
  appearances: number;
  maxWeeks: number;
}

// ============================================
// NYT SNAPSHOTS (cached)
// ============================================

async function loadSnapshot(date: string): Promise<{ entries: NytEntry[]; cached: boolean }> {
  const file = join(CACHE_DIR, `${date}.json`);
  if (existsSync(file)) {
    return { entries: JSON.parse(readFileSync(file, "utf8")).entries, cached: true };
  }
  const overview = await fetchOverview(date, { apiKey: nytApiKey as string });
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(overview));
  return { entries: overview.entries, cached: false };
}

/**
 * Collapses every snapshot into one candidate per title: keyed by ISBN-13,
 * then by normalised title+author so hardcover, paperback and audio editions
 * of the same book collapse too. The newest appearance wins, so the ISBN
 * (and with it the cover) is the current edition's.
 */
function collect(snapshots: NytEntry[][]): {
  candidates: Candidate[];
  perList: Map<string, { entries: number; titles: Set<string> }>;
  dropped: { noIsbn: number; boxSet: number; filteredList: number };
} {
  const byIsbn = new Map<string, Candidate>();
  const byTitle = new Map<string, Candidate>();
  const perList = new Map<string, { entries: number; titles: Set<string> }>();
  const dropped = { noIsbn: 0, boxSet: 0, filteredList: 0 };

  for (const entries of snapshots) {
    for (const entry of entries) {
      const listAllowed = onlyLists
        ? onlyLists.includes(entry.listName)
        : !EXCLUDED_LISTS.test(entry.listName);
      if (!listAllowed) {
        dropped.filteredList++;
        continue;
      }
      if (!entry.primaryIsbn13) {
        dropped.noIsbn++;
        continue;
      }
      if (isBoxSet(entry.title)) {
        dropped.boxSet++;
        continue;
      }
      const author = cleanAuthor(entry.author);
      const title = stripEditionSuffix(entry.title);
      const key = titleAuthorKey(title, author);
      const stats = perList.get(entry.listName) ?? { entries: 0, titles: new Set<string>() };
      stats.entries++;
      stats.titles.add(key);
      perList.set(entry.listName, stats);

      const existing = byIsbn.get(entry.primaryIsbn13) ?? byTitle.get(key);
      if (existing) {
        existing.appearances++;
        existing.lists.add(entry.listName);
        existing.bestRank = Math.min(existing.bestRank, entry.rank || 99);
        existing.maxWeeks = Math.max(existing.maxWeeks, entry.weeksOnList);
        if (entry.publishedDate >= existing.lastSeen) {
          existing.lastSeen = entry.publishedDate;
          // Newest edition wins the ISBN
          if (existing.isbn !== entry.primaryIsbn13) {
            byIsbn.delete(existing.isbn);
            existing.isbn = entry.primaryIsbn13;
            byIsbn.set(existing.isbn, existing);
          }
          existing.description = entry.description ?? existing.description;
        }
        if (entry.publishedDate < existing.firstSeen) existing.firstSeen = entry.publishedDate;
        continue;
      }
      const candidate: Candidate = {
        isbn: entry.primaryIsbn13,
        title,
        author,
        description: entry.description,
        lists: new Set([entry.listName]),
        firstSeen: entry.publishedDate,
        lastSeen: entry.publishedDate,
        bestRank: entry.rank || 99,
        appearances: 1,
        maxWeeks: entry.weeksOnList,
      };
      byIsbn.set(candidate.isbn, candidate);
      byTitle.set(key, candidate);
    }
  }
  return { candidates: [...byTitle.values()], perList, dropped };
}

function toImportCandidate(c: Candidate): ImportCandidate {
  return {
    title: titleCase(c.title),
    author: c.author,
    isbn: c.isbn,
    description: c.description,
    genres: [...[...c.lists].flatMap(listGenres), "Bestseller"],
  };
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("📰 NYT Bestseller Import");
  console.log("=".repeat(50));
  console.log(`Mode: ${isDryRun ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`Range: ${from} → ${to}${onlyLists ? `, lists: ${onlyLists.join(", ")}` : ""}`);
  if (limit !== Infinity) console.log(`Limit: ${limit} new titles`);
  console.log(`Staying power: best weeks_on_list >= ${minWeeks} (--min-weeks)`);
  console.log(`Google Books: ${googleStatus()}`);
  console.log();

  // 1. Snapshots
  const dates = firstSundays(from, to);
  console.log(`📅 ${dates.length} monthly snapshots (13 s between uncached calls)`);
  const snapshots: NytEntry[][] = [];
  let apiCalls = 0;
  for (const [i, date] of dates.entries()) {
    const { entries, cached } = await loadSnapshot(date);
    snapshots.push(entries);
    if (!cached) apiCalls++;
    if (isVerbose || !cached) {
      console.log(`   ${date}: ${entries.length} entries${cached ? " (cached)" : ""}`);
    }
    if (!cached && i < dates.length - 1) await sleep(NYT_DELAY_MS);
  }
  console.log(`   ${apiCalls} API calls, ${dates.length - apiCalls} from cache\n`);

  // 2. In-memory dedupe
  const { candidates, perList, dropped } = collect(snapshots);
  console.log("📋 Per list (entries seen / distinct titles):");
  for (const [name, stats] of [...perList.entries()].sort((a, b) => b[1].titles.size - a[1].titles.size)) {
    console.log(`   ${name.padEnd(44)} ${String(stats.entries).padStart(6)} / ${stats.titles.size}`);
  }
  console.log(
    `\n   ${candidates.length} distinct titles; dropped ${dropped.boxSet} box sets/volumes, ${dropped.noIsbn} without ISBN-13, ${dropped.filteredList} on ${onlyLists ? "other" : "excluded (audio, e-book, series)"} lists`
  );
  const weeksBuckets = [1, 2, 4, 8, 13, 26];
  console.log(
    "   Staying power (titles with >= n weeks): " +
      weeksBuckets.map((n) => `${n}w ${candidates.filter((c) => c.maxWeeks >= n).length}`).join(", ")
  );
  const lasting = candidates.filter((c) => c.maxWeeks >= minWeeks);

  // 3. Catalog dedupe
  const index = await loadCatalogIndex(supabase);
  const fresh = lasting
    .filter((c) => !findExisting(index, toImportCandidate(c)))
    // Most recent bestsellers first, so a partial run still lands the relevant ones
    .sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : a.lastSeen > b.lastSeen ? -1 : a.bestRank - b.bestRank));
  console.log(
    `   ${lasting.length} titles pass --min-weeks ${minWeeks}; catalog has ${index.titleAuthors.size} books; ${lasting.length - fresh.length} already present, ${fresh.length} new\n`
  );

  if (isDryRun) {
    if (isVerbose) {
      for (const c of fresh.slice(0, 50)) {
        console.log(`   + ${titleCase(c.title)} — ${c.author} (${c.isbn}, ${[...c.lists].join("/")}, last ${c.lastSeen})`);
      }
      if (fresh.length > 50) console.log(`   … and ${fresh.length - 50} more`);
    }
    console.log("✅ Dry run complete. No changes made.");
    return;
  }

  // 4. Enrich, insert, covers
  const queue = fresh.slice(0, limit === Infinity ? undefined : limit).map(toImportCandidate);
  const stats = await runQueue(supabase, queue, index, { verbose: isVerbose });
  printSummary(stats, [`Remaining new titles: ${fresh.length - queue.length}`]);
  console.log("\n✅ Import complete.");
}

main().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
