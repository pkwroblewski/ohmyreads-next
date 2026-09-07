/**
 * Award Winners Import (Catalog launch, Task 5; restored from scripts/archive)
 *
 * Imports award-winning books from Open Library award subjects, tags them
 * with the award, and adds the tag to books already in the catalog. New rows
 * go through the shared insert helper and the cover pipeline.
 *
 * Usage:
 *   npm run import:awards                        # every award, 100 works each
 *   npm run import:awards -- --dry-run           # counts only, no writes
 *   npm run import:awards -- --award pulitzer    # one award
 *   npm run import:awards -- --limit 50          # works per award (default 100)
 *   npm run import:awards -- --list              # available awards
 *   npm run import:awards -- --verbose
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local;
 *   GOOGLE_BOOKS_API_KEY optional.
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
import { searchWorksBySubject, workToCandidate, type SkipReason } from "./lib/ol-search";

config({ path: ".env.local" });
const supabase = createServiceClient();

// ============================================
// AWARD DEFINITIONS
// ============================================

interface AwardDefinition {
  displayName: string;
  /** Open Library subject keys (all tried, results merged) */
  subjects: string[];
  tag: string;
}

const AWARDS: Record<string, AwardDefinition> = {
  pulitzer: { displayName: "Pulitzer Prize", subjects: ["pulitzer_prize"], tag: "Pulitzer Prize" },
  hugo: { displayName: "Hugo Award", subjects: ["hugo_award"], tag: "Hugo Award" },
  booker: { displayName: "Booker Prize", subjects: ["booker_prize", "man_booker_prize"], tag: "Booker Prize" },
  national_book: { displayName: "National Book Award", subjects: ["national_book_award"], tag: "National Book Award" },
  newbery: { displayName: "Newbery Medal", subjects: ["newbery_medal"], tag: "Newbery Medal" },
  caldecott: { displayName: "Caldecott Medal", subjects: ["caldecott_medal"], tag: "Caldecott Medal" },
  nebula: { displayName: "Nebula Award", subjects: ["nebula_award"], tag: "Nebula Award" },
  womens_prize: {
    displayName: "Women's Prize for Fiction",
    subjects: ["womens_prize_for_fiction", "women's_prize_for_fiction", "orange_prize"],
    tag: "Women's Prize for Fiction",
  },
  international_booker: {
    displayName: "International Booker Prize",
    subjects: ["international_booker_prize", "man_booker_international_prize"],
    tag: "International Booker Prize",
  },
};

const DEFAULT_LIMIT = 100;
const SUBJECT_DELAY_MS = 1_000;

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

const selectedAward = argValue("--award");
const limitPerAward = argValue("--limit") ? parseInt(argValue("--limit") as string, 10) : DEFAULT_LIMIT;

if (args.includes("--list")) {
  console.log("Available awards:");
  for (const [key, a] of Object.entries(AWARDS)) console.log(`  ${key.padEnd(22)} ${a.displayName} (subjects: ${a.subjects.join(", ")})`);
  process.exit(0);
}
if (selectedAward && !(selectedAward in AWARDS)) {
  console.error(`Unknown award "${selectedAward}". Use --list.`);
  process.exit(1);
}

// ============================================
// TAG EXISTING ROWS
// ============================================

let tagged = 0;
let alreadyTagged = 0;

async function addTag(bookId: string, tag: string): Promise<void> {
  const { data: row, error } = await supabase.from("books").select("genres").eq("id", bookId).single();
  if (error || !row) throw new Error(`read genres for ${bookId}: ${error?.message ?? "no row"}`);
  const genres = row.genres ?? [];
  if (genres.includes(tag)) {
    alreadyTagged++;
    return;
  }
  const { data, error: updateError } = await supabase
    .from("books")
    .update({ genres: [...genres, tag] })
    .eq("id", bookId)
    .select("id");
  if (updateError) throw updateError;
  if (!data || data.length === 0) throw new Error(`book ${bookId} not found for tagging`);
  tagged++;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("🏆 Award Winners Import (Open Library)");
  console.log("=".repeat(50));
  console.log(`Mode: ${isDryRun ? "DRY RUN (no writes)" : "LIVE"}`);
  const awards = Object.entries(AWARDS).filter(([key]) => !selectedAward || key === selectedAward);
  console.log(`Awards: ${awards.map(([, a]) => a.displayName).join(", ")}; ${limitPerAward} works per subject`);
  console.log(`Google Books: ${googleStatus()}`);
  console.log();

  // 1. Fetch, one candidate per work carrying every award tag it earned
  const byWork = new Map<string, { candidate: ImportCandidate; tags: Set<string>; readinglog: number }>();
  const skipped: Record<SkipReason, number> = { "no-author": 0, "no-year": 0, "box-set": 0, "no-english-edition": 0, "no-title": 0 };
  for (const [, award] of awards) {
    let total = 0;
    for (const subject of award.subjects) {
      let docs;
      try {
        docs = await searchWorksBySubject(subject, limitPerAward);
      } catch (error) {
        console.log(`   ✗ ${award.displayName} (${subject}): ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      total += docs.length;
      for (const doc of docs) {
        const result = await workToCandidate(doc, [award.tag]);
        if ("skip" in result) {
          skipped[result.skip]++;
          continue;
        }
        const existing = byWork.get(doc.key);
        if (existing) {
          existing.tags.add(award.tag);
          existing.candidate.genres = unique([...existing.candidate.genres, award.tag]);
        } else {
          byWork.set(doc.key, { candidate: result.candidate, tags: new Set([award.tag]), readinglog: doc.readinglog_count ?? 0 });
        }
      }
      await sleep(SUBJECT_DELAY_MS);
    }
    console.log(`   ${award.displayName.padEnd(28)} ${total} works`);
  }
  console.log(`\n📋 ${byWork.size} distinct works; skipped: ${Object.entries(skipped).map(([k, v]) => `${k} ${v}`).join(", ")}`);

  // 2. Split: existing rows get tagged, new ones imported
  const index = await loadCatalogIndex(supabase);
  const all = [...byWork.values()];
  const present = all.map((c) => ({ ...c, existing: findExisting(index, c.candidate) })).filter((c) => c.existing);
  const fresh = all.filter((c) => !findExisting(index, c.candidate)).sort((a, b) => b.readinglog - a.readinglog);
  console.log(`   Catalog has ${index.titleAuthors.size} books; ${present.length} already present (will be tagged), ${fresh.length} new\n`);

  if (isDryRun) {
    if (isVerbose) {
      for (const c of fresh.slice(0, 60)) {
        console.log(`   + ${c.candidate.title} — ${c.candidate.author} (${c.candidate.isbn ?? "no isbn"}, ${[...c.tags].join("/")})`);
      }
      if (fresh.length > 60) console.log(`   … and ${fresh.length - 60} more`);
    }
    console.log("✅ Dry run complete. No changes made.");
    return;
  }

  // 3. Tag existing rows
  for (const c of present) {
    for (const tag of c.tags) {
      try {
        await addTag((c.existing as { id: string }).id, tag);
      } catch (error) {
        console.log(`   ✗ tag "${tag}" on ${c.candidate.title}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  console.log(`🏷️  Existing rows: ${tagged} tagged, ${alreadyTagged} already carried the tag`);

  // 4. Import new ones; duplicates discovered after enrichment get tagged too
  const stats = await runQueue(supabase, fresh.map((c) => c.candidate), index, {
    verbose: isVerbose,
    onOutcome: async (candidate, outcome) => {
      if (outcome.kind !== "duplicate") return;
      for (const tag of candidate.genres.filter((g) => Object.values(AWARDS).some((a) => a.tag === g))) {
        await addTag(outcome.existingId, tag);
      }
    },
  });
  printSummary(stats, [`Existing rows tagged: ${tagged}`]);
  console.log("\n✅ Import complete.");
}

main().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
