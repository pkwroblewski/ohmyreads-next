/**
 * Popular-per-genre Import (Catalog launch, Task 5)
 *
 * For each site genre, asks Open Library for the most-read English works of
 * the matching subject (plus this week's trending works), deduplicates them
 * against the catalog, fetches descriptions, inserts through the shared
 * slug-safe helper and runs the cover pipeline.
 *
 * Usage:
 *   npm run import:subjects                          # every subject, 100 works each
 *   npm run import:subjects -- --dry-run             # counts only, no writes
 *   npm run import:subjects -- --subjects fantasy,horror
 *   npm run import:subjects -- --limit 50            # works per subject (default 100)
 *   npm run import:subjects -- --max 200             # stop after N new titles
 *   npm run import:subjects -- --no-trending
 *   npm run import:subjects -- --verbose
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local;
 *   GOOGLE_BOOKS_API_KEY optional.
 *
 * Resumable: works already in the catalog (ISBN, normalised title+author or
 * Open Library work id) are skipped. Search responses are cached under
 * node_modules/.cache/ohmyreads/ol-search.
 */

import { config } from "dotenv";
import {
  createServiceClient,
  findExisting,
  googleStatus,
  loadCatalogIndex,
  printSummary,
  runQueue,
  sleep,
  unique,
  type ImportCandidate,
} from "./lib/import-core";
import { fetchTrendingWorks, searchWorksBySubject, workToCandidate, type SkipReason } from "./lib/ol-search";

config({ path: ".env.local" });
const supabase = createServiceClient();

// ============================================
// SUBJECTS → SITE GENRES
// ============================================

const SUBJECTS: Record<string, string[]> = {
  fantasy: ["Fantasy"],
  romance: ["Romance"],
  thriller: ["Thriller"],
  mystery: ["Mystery"],
  science_fiction: ["Science Fiction"],
  horror: ["Horror"],
  historical_fiction: ["Historical Fiction"],
  literary_fiction: ["Literary Fiction"],
  young_adult: ["Young Adult"],
  self_help: ["Self-Help", "Non-Fiction"],
  memoir: ["Memoir", "Non-Fiction"],
  biography: ["Biography", "Non-Fiction"],
  history: ["History", "Non-Fiction"],
  science: ["Science", "Non-Fiction"],
  business: ["Business", "Non-Fiction"],
  psychology: ["Psychology", "Non-Fiction"],
  graphic_novels: ["Graphic Novel"],
  poetry: ["Poetry"],
  children: ["Children"],
  classics: ["Classics"],
  dystopia: ["Dystopian"],
  humor: ["Humor"],
  philosophy: ["Philosophy", "Non-Fiction"],
  true_crime: ["True Crime", "Non-Fiction"],
  travel: ["Travel", "Non-Fiction"],
  cooking: ["Cooking", "Non-Fiction"],
  essays: ["Essays", "Non-Fiction"],
  short_stories: ["Short Stories"],
  adventure: ["Adventure"],
  crime: ["Crime"],
  contemporary: ["Contemporary"],
  paranormal: ["Paranormal"],
  lgbt: ["LGBTQ+"],
  nonfiction: ["Non-Fiction"],
  religion: ["Religion", "Non-Fiction"],
  // Aliases: the bare subjects above left these two genres under 100 rows
  popular_science: ["Science", "Non-Fiction"],
  adventure_stories: ["Adventure"],
};

const SUBJECT_DELAY_MS = 1_000; // between uncached search calls
const DEFAULT_LIMIT = 100;
const TRENDING_LIMIT = 100;

// ============================================
// CLI ARGUMENTS
// ============================================

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isVerbose = args.includes("--verbose");
const noTrending = args.includes("--no-trending");

function argValue(flag: string): string | null {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

const limitPerSubject = argValue("--limit") ? parseInt(argValue("--limit") as string, 10) : DEFAULT_LIMIT;
const maxNew = argValue("--max") ? parseInt(argValue("--max") as string, 10) : Infinity;
const onlySubjects = argValue("--subjects")
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ============================================
// MAIN
// ============================================

interface Collected {
  candidate: ImportCandidate;
  readinglog: number;
  sources: Set<string>;
  /** Where the work ranks in each subject that lists it */
  ranked: Array<{ position: number; genres: string[] }>;
}

// A classic shows up in a dozen subjects; keep the genres of the subjects
// where it ranks highest instead of every one it touches.
const MAX_SUBJECTS_PER_WORK = 3;

async function main() {
  console.log("📚 Popular-per-genre Import (Open Library)");
  console.log("=".repeat(50));
  console.log(`Mode: ${isDryRun ? "DRY RUN (no writes)" : "LIVE"}`);
  const subjects = Object.keys(SUBJECTS).filter((s) => !onlySubjects || onlySubjects.includes(s));
  const unknown = onlySubjects?.filter((s) => !(s in SUBJECTS)) ?? [];
  if (unknown.length > 0) {
    console.error(`Unknown subjects: ${unknown.join(", ")}. Known: ${Object.keys(SUBJECTS).join(", ")}`);
    process.exit(1);
  }
  console.log(`Subjects: ${subjects.length}, ${limitPerSubject} works each${noTrending ? "" : `, + trending ${TRENDING_LIMIT}`}`);
  if (maxNew !== Infinity) console.log(`Max new titles: ${maxNew}`);
  console.log(`Google Books: ${googleStatus()}`);
  console.log();

  // 1. Fetch and collect, one candidate per work
  const byWork = new Map<string, Collected>();
  const skipped: Record<SkipReason, number> = { "no-author": 0, "no-year": 0, "box-set": 0, "no-english-edition": 0, "no-title": 0 };
  const perSource: Array<[string, number, number]> = [];
  const sources: Array<{ name: string; genres: string[]; fetch: () => Promise<Awaited<ReturnType<typeof searchWorksBySubject>>> }> =
    subjects.map((s) => ({ name: s, genres: SUBJECTS[s], fetch: () => searchWorksBySubject(s.replace(/_/g, " "), limitPerSubject) }));
  if (!noTrending) sources.push({ name: "trending", genres: [], fetch: () => fetchTrendingWorks(TRENDING_LIMIT) });

  for (const source of sources) {
    let docs;
    try {
      docs = await source.fetch();
    } catch (error) {
      console.log(`   ✗ ${source.name}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    let kept = 0;
    for (const [position, doc] of docs.entries()) {
      const result = await workToCandidate(doc, source.genres);
      if ("skip" in result) {
        skipped[result.skip]++;
        continue;
      }
      kept++;
      const key = doc.key;
      const existing = byWork.get(key);
      if (existing) {
        existing.ranked.push({ position, genres: source.genres });
        existing.sources.add(source.name);
      } else {
        byWork.set(key, {
          candidate: result.candidate,
          readinglog: doc.readinglog_count ?? 0,
          sources: new Set([source.name]),
          ranked: [{ position, genres: source.genres }],
        });
      }
    }
    perSource.push([source.name, docs.length, kept]);
    if (isVerbose) console.log(`   ${source.name.padEnd(22)} ${String(docs.length).padStart(4)} works, ${kept} usable`);
    await sleep(SUBJECT_DELAY_MS);
  }
  for (const c of byWork.values()) {
    c.candidate.genres = unique(
      c.ranked
        .filter((r) => r.genres.length > 0)
        .sort((a, b) => a.position - b.position)
        .slice(0, MAX_SUBJECTS_PER_WORK)
        .flatMap((r) => r.genres)
    );
  }
  console.log(`📋 ${sources.length} sources: ${perSource.reduce((n, s) => n + s[1], 0)} works, ${byWork.size} distinct`);
  console.log(`   Skipped: ${Object.entries(skipped).map(([k, v]) => `${k} ${v}`).join(", ")}`);

  // 2. Catalog dedupe; most-read first so a partial run lands the known titles
  const index = await loadCatalogIndex(supabase);
  const all = [...byWork.values()];
  const present = all.filter((c) => findExisting(index, c.candidate));
  const fresh = all
    .filter((c) => !findExisting(index, c.candidate))
    .sort((a, b) => b.readinglog - a.readinglog);
  console.log(`   Catalog has ${index.titleAuthors.size} books; ${present.length} already present, ${fresh.length} new\n`);
  const perGenre = new Map<string, number>();
  for (const c of fresh) for (const g of c.candidate.genres) perGenre.set(g, (perGenre.get(g) ?? 0) + 1);
  console.log("   New titles per genre: " + [...perGenre.entries()].sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} ${n}`).join(", "));

  if (isDryRun) {
    if (isVerbose) {
      for (const c of fresh.slice(0, 60)) {
        console.log(`   + ${c.candidate.title} — ${c.candidate.author} (${c.candidate.isbn ?? "no isbn"}, ${[...c.sources].join("/")}, rl ${c.readinglog})`);
      }
      if (fresh.length > 60) console.log(`   … and ${fresh.length - 60} more`);
    }
    console.log("\n✅ Dry run complete. No changes made.");
    return;
  }

  // 3. Enrich, insert, covers
  const queue = fresh.slice(0, maxNew === Infinity ? undefined : maxNew).map((c) => c.candidate);
  const stats = await runQueue(supabase, queue, index, { verbose: isVerbose });
  printSummary(stats, [`Remaining new titles: ${fresh.length - queue.length}`]);
  console.log("\n✅ Import complete.");
}

main().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
