/**
 * Spine Colour Backfill (Shelf design build, Task 4)
 *
 * Fills `books.spine_color` / `books.spine_ink` from each book's cover, for
 * rows that have a `cover_url` and no spine colour yet. New covers get their
 * colours from the cover pipeline; this script covers the existing catalog.
 *
 * Usage:
 *   npm run covers:spines                    # every covered book without a spine colour
 *   npm run covers:spines -- --dry-run       # compute and print, write nothing
 *   npm run covers:spines -- --limit 20      # stop after 20 books
 *
 * Environment:
 *   Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { spineColours } from "../lib/covers/spine-colour";
import { isStoredCover } from "../lib/covers/pipeline";
import type { Database } from "../types/database";

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

const PAGE_SIZE = 200;
const CONCURRENCY = 6;
/** Only slow down for third-party hosts; the bucket is our own CDN. */
const EXTERNAL_DELAY_MS = 500;
const FETCH_TIMEOUT_MS = 15_000;

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const limitIndex = args.indexOf("--limit");
const limit =
  limitIndex !== -1 && args[limitIndex + 1]
    ? parseInt(args[limitIndex + 1], 10)
    : Infinity;

interface BookRow {
  id: string;
  title: string;
  cover_url: string | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Rows are re-read from the start each page: a written row drops out of the
 * `spine_color is null` filter. In a dry run nothing is written, so page by
 * offset instead.
 */
async function nextPage(offset: number): Promise<BookRow[]> {
  const { data, error } = await supabase
    .from("books")
    .select("id, title, cover_url")
    .not("cover_url", "is", null)
    .is("spine_color", null)
    .order("id", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  return data ?? [];
}

async function colourOne(book: BookRow): Promise<"done" | "failed"> {
  try {
    const res = await fetch(book.cover_url as string, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const spine = await spineColours(Buffer.from(await res.arrayBuffer()));

    if (isDryRun) {
      console.log(`   ${spine.color} ${spine.ink ?? "auto   "}  ${book.title}`);
      return "done";
    }

    const { data, error } = await supabase
      .from("books")
      .update({ spine_color: spine.color, spine_ink: spine.ink })
      .eq("id", book.id)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("no row updated");
    return "done";
  } catch (error) {
    console.log(
      `   ✗ ${book.title}: ${error instanceof Error ? error.message : String(error)}`
    );
    return "failed";
  } finally {
    if (!isStoredCover(book.cover_url)) await sleep(EXTERNAL_DELAY_MS);
  }
}

async function run(): Promise<void> {
  console.log(`Spine colour backfill${isDryRun ? " (DRY RUN, nothing is written)" : ""}`);

  const counts = { done: 0, failed: 0 };
  const failedIds = new Set<string>();
  let offset = 0;
  let attempted = 0;

  while (attempted < limit) {
    const page = (await nextPage(offset)).filter((b) => !failedIds.has(b.id));
    if (page.length === 0) break;
    const batch = page.slice(0, Math.min(page.length, limit - attempted));

    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map(colourOne));
      results.forEach((r, j) => {
        counts[r]++;
        if (r === "failed") failedIds.add(chunk[j].id);
      });
      attempted += chunk.length;
      process.stdout.write(`\r   ${attempted} books, ${counts.failed} failed`);
    }
    console.log();

    // Written rows leave the filter; failed and dry-run rows stay, so skip them.
    if (isDryRun) offset += PAGE_SIZE;
    else offset = failedIds.size;
  }

  console.log(`\nDone: ${counts.done} coloured, ${counts.failed} failed.`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nBackfill failed:", error);
    process.exit(1);
  });
