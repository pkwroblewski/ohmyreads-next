/**
 * Server-side cover pipeline (Catalog launch, Task 1).
 *
 * The browser cannot tell a real cover from Google's grey placeholder (some
 * real covers share its bytes, CORS blocks canvas) and cannot compare the
 * pixel size of candidates before choosing one. This module does it once,
 * server-side: download every candidate, measure it, reject placeholders and
 * anything too small, keep the sharpest, and store one JPEG per book in the
 * public `book-covers` bucket. From then on the row's `cover_url` is the only
 * candidate the UI needs.
 *
 * Runs from CLI scripts (tsx) and from server actions, so it takes the
 * service-role client as a parameter instead of importing `server-only`
 * modules, and logs through `lib/utils/log.ts`.
 */

import { createHash } from "crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  COVER_BUCKET,
  getCoverSource,
  getCoverUrlsWithFallbacks,
  isStoredCover,
  type BookCoverData,
} from "@/lib/utils/covers";
import { logError } from "@/lib/utils/log";

// Defined in the client-safe utils module (no sharp) so the renderer can use
// them too; re-exported here for pipeline callers.
export { COVER_BUCKET, isStoredCover };

/**
 * Below this the cover is visibly soft on a 2× display at card size. Open
 * Library's large size is capped at 500 px tall, so a narrow-aspect scan can
 * be 290 px wide and still be as sharp as a 330 px one: a candidate is only
 * "too small" when it misses both the width and the height floor.
 */
export const MIN_COVER_WIDTH = 300;
export const MIN_COVER_HEIGHT = 450;
/** Portrait book covers; rejects banners, logos and square avatars. */
export const MIN_ASPECT = 0.55;
export const MAX_ASPECT = 0.85;
/** Stored size: fits the largest detail view at 2× and stays ~80–120 KB. */
export const STORED_COVER_WIDTH = 800;
export const STORED_COVER_QUALITY = 85;

/**
 * MD5s of Google Books' "image not available" placeholders: the 128×170 grey
 * served at zoom 1 and the 575×750 one served at zoom 3 (9,103 bytes, seen
 * identical across six classics on 2026-09-05). Both pass every size/aspect
 * check, so a hash is the only reliable test.
 */
export const PLACEHOLDER_MD5 = new Set([
  "e89e0e364e83c0ecfba5da41007c9a2c",
  "a64fa89d7ebc97075c1d363fc5fea71f",
  // Penguin logo on white that Google serves as the "cover" of some Penguin
  // titles (575×863, 14 KB; The Count of Monte Cristo, 2026-09-05).
  "14387444ce9dc94155df22f5d1832461",
]);

/**
 * Encoded bytes per pixel below which a JPEG is a logo or placeholder, not
 * cover art: the grey placeholders sit at 0.02, the Penguin logo at 0.03,
 * while real covers measured 0.1 (small Open Library scans) to 0.6.
 */
export const MIN_BYTES_PER_PIXEL = 0.05;

const FETCH_TIMEOUT_MS = 15_000;
const MAX_CANDIDATE_BYTES = 5 * 1024 * 1024;

/**
 * Open Library asks every client to identify itself and give a contact;
 * unnamed clients are the first to be throttled.
 */
/**
 * Env values pasted through the Vercel CLI carry a literal CR-LF (the same
 * defect behind the CSRF and Sentry DSN fixes). Inside Next the loader turns
 * it into real control characters, and undici rejects a header that contains
 * one before the request is sent, so every candidate would be "fetch-failed".
 */
function headerSafeEnv(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/[\r\n]/g, "").trim();
  return cleaned || undefined;
}

const USER_AGENT = `OhMyReads/1.0 (${
  headerSafeEnv(process.env.NEXT_PUBLIC_SITE_URL) ?? "https://ohmyreads-next.vercel.app"
}; ${headerSafeEnv(process.env.OPEN_LIBRARY_CONTACT) ?? "contact via site"})`;

export type CoverSource = "google" | "openlibrary" | "other";

export interface CoverCandidate {
  url: string;
}

export type CandidateRejection =
  | "http-error"
  | "not-image"
  | "placeholder"
  | "low-detail"
  | "too-small"
  | "bad-aspect"
  | "too-large"
  | "fetch-failed";

export interface ScoredCandidate {
  url: string;
  /** Where the bytes actually came from after redirects. */
  finalUrl: string;
  ok: boolean;
  reason?: CandidateRejection;
  width?: number;
  height?: number;
  bytes?: number;
  buffer?: Buffer;
  /** Open Library cover id, when the final URL reveals one. */
  openLibraryCoverId?: number;
}

/** A scored candidate with the image bytes dropped, as returned to callers. */
export type CandidateReport = Omit<ScoredCandidate, "buffer">;

export interface PipelineBook extends BookCoverData {
  id: string;
}

export interface ProcessOptions {
  /** Re-process even when `cover_url` already points at the bucket. */
  force?: boolean;
  /** Extra candidate URLs from an importer (e.g. NYT `book_image`). Tried first. */
  extraUrls?: string[];
  /** Do everything except upload and update the row. */
  dryRun?: boolean;
  /** Overrides the placeholder hash set (tests). */
  placeholderHashes?: Set<string>;
  fetchImpl?: typeof fetch;
}

export type ProcessResult =
  | { status: "skipped"; reason: "already-stored"; coverUrl: string }
  | {
      status: "stored";
      coverUrl: string;
      source: CoverSource;
      width: number;
      height: number;
      candidates: CandidateReport[];
    }
  | {
      status: "no-candidate";
      candidates: CandidateReport[];
      /** A forced re-run found nothing valid, so the stored cover was removed. */
      cleared?: boolean;
    }
  | { status: "failed"; error: string; candidates: CandidateReport[] };

/**
 * Candidate URLs in priority order. Order only breaks ties on width:
 * importer extras (the current edition), then the existing chain from
 * `lib/utils/covers.ts` (Open Library by id, by ISBN, the stored remote URL,
 * Google at zoom 3). A `cover_url` already on the bucket is not a candidate.
 */
export function collectCandidates(
  book: BookCoverData,
  extraUrls: string[] = []
): CoverCandidate[] {
  const seen = new Set<string>();
  const out: CoverCandidate[] = [];
  const push = (url: string) => {
    if (!url || seen.has(url) || isStoredCover(url)) return;
    seen.add(url);
    out.push({ url });
  };
  extraUrls.forEach(push);
  // The renderer's chain collapses to the stored URL once a book has one;
  // the pipeline must still see the real sources when re-processing.
  const unstored = isStoredCover(book.cover_url)
    ? { ...book, cover_url: null }
    : book;
  getCoverUrlsWithFallbacks(unstored).forEach(push);
  return out;
}

function coverIdFromUrl(url: string): number | undefined {
  const match = /covers\.openlibrary\.org\/b\/id\/(\d+)-[SML]\.jpg/i.exec(url);
  return match ? Number(match[1]) : undefined;
}

/**
 * Downloads one candidate and measures it. Never throws: every failure is a
 * rejection with a reason so callers can report why a book has no cover.
 */
export async function fetchAndScore(
  url: string,
  opts: Pick<ProcessOptions, "placeholderHashes" | "fetchImpl"> = {}
): Promise<ScoredCandidate> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const hashes = opts.placeholderHashes ?? PLACEHOLDER_MD5;
  const reject = (
    reason: CandidateRejection,
    extra: Partial<ScoredCandidate> = {}
  ): ScoredCandidate => ({ url, finalUrl: url, ok: false, reason, ...extra });

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return reject("fetch-failed");
  }

  const finalUrl = response.url || url;
  if (!response.ok) return reject("http-error", { finalUrl });

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.startsWith("image/")) {
    return reject("not-image", { finalUrl });
  }

  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_CANDIDATE_BYTES) return reject("too-large", { finalUrl });

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await response.arrayBuffer());
  } catch {
    return reject("fetch-failed", { finalUrl });
  }
  if (buffer.byteLength > MAX_CANDIDATE_BYTES) {
    return reject("too-large", { finalUrl, bytes: buffer.byteLength });
  }

  const md5 = createHash("md5").update(buffer).digest("hex");
  if (hashes.has(md5)) {
    return reject("placeholder", { finalUrl, bytes: buffer.byteLength });
  }

  let width: number | undefined;
  let height: number | undefined;
  try {
    const meta = await sharp(buffer).metadata();
    width = meta.width;
    height = meta.height;
  } catch {
    return reject("not-image", { finalUrl, bytes: buffer.byteLength });
  }
  if (!width || !height) {
    return reject("not-image", { finalUrl, bytes: buffer.byteLength });
  }

  const dims = { finalUrl, width, height, bytes: buffer.byteLength };
  if (buffer.byteLength / (width * height) < MIN_BYTES_PER_PIXEL) {
    return reject("low-detail", dims);
  }
  if (width < MIN_COVER_WIDTH && height < MIN_COVER_HEIGHT) {
    return reject("too-small", dims);
  }
  const aspect = width / height;
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) {
    return reject("bad-aspect", dims);
  }

  return {
    url,
    ok: true,
    buffer,
    ...dims,
    openLibraryCoverId: coverIdFromUrl(finalUrl) ?? coverIdFromUrl(url),
  };
}

/** Widest passing candidate; on equal width the earlier one wins. */
export function pickBest(
  scored: ScoredCandidate[]
): ScoredCandidate | undefined {
  let best: ScoredCandidate | undefined;
  for (const candidate of scored) {
    if (!candidate.ok || !candidate.width) continue;
    if (!best || candidate.width > (best.width ?? 0)) best = candidate;
  }
  return best;
}

/**
 * Normalises the winner (≤ 800 px wide JPEG q85), uploads it as
 * `book-covers/{bookId}.jpg` and returns the public URL. The URL carries a
 * version query so a re-processed cover busts the CDN and `next/image` caches.
 */
export async function storeCover(
  admin: SupabaseClient<Database>,
  bookId: string,
  buffer: Buffer
): Promise<string> {
  const jpeg = await sharp(buffer)
    .rotate()
    .resize({ width: STORED_COVER_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: STORED_COVER_QUALITY, mozjpeg: true })
    .toBuffer();

  const path = `${bookId}.jpg`;
  const { error } = await admin.storage.from(COVER_BUCKET).upload(path, jpeg, {
    upsert: true,
    contentType: "image/jpeg",
    cacheControl: "31536000",
  });
  if (error) throw new Error(`storage upload failed: ${error.message}`);

  const { data } = admin.storage.from(COVER_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Math.floor(Date.now() / 1000)}`;
}

function toReport(candidate: ScoredCandidate): CandidateReport {
  const rest: Partial<ScoredCandidate> = { ...candidate };
  delete rest.buffer;
  return rest as CandidateReport;
}

/** Deletes `book-covers/{bookId}.jpg` and nulls the row's cover columns. */
async function clearStoredCover(
  admin: SupabaseClient<Database>,
  bookId: string
): Promise<void> {
  const { error: removeError } = await admin.storage
    .from(COVER_BUCKET)
    .remove([`${bookId}.jpg`]);
  if (removeError) {
    throw new Error(`storage remove failed: ${removeError.message}`);
  }
  const { data, error } = await admin
    .from("books")
    .update({ cover_url: null, cover_source: null })
    .eq("id", bookId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("book row not found");
}

function sourceOf(url: string): CoverSource {
  const source = getCoverSource(url);
  return source === "google" || source === "openlibrary" ? source : "other";
}

/**
 * Runs the whole pipeline for one book. Skips books whose `cover_url` is
 * already on the bucket unless `force`. On success updates `cover_url`,
 * `cover_source` (the winner's origin) and, when discovered, the Open Library
 * cover id. When nothing passes the row is left untouched, except on a forced
 * re-run of a stored cover: that cover failed re-verification, so it is
 * removed from the bucket and the row falls back to the render-time chain.
 */
export async function processBook(
  admin: SupabaseClient<Database>,
  book: PipelineBook,
  opts: ProcessOptions = {}
): Promise<ProcessResult> {
  if (!opts.force && isStoredCover(book.cover_url)) {
    return {
      status: "skipped",
      reason: "already-stored",
      coverUrl: book.cover_url as string,
    };
  }

  const candidates = collectCandidates(book, opts.extraUrls);
  const scored: ScoredCandidate[] = [];
  for (const candidate of candidates) {
    scored.push(await fetchAndScore(candidate.url, opts));
  }

  const winner = pickBest(scored);
  // Strip buffers before handing results back; callers only need the verdicts.
  const report = scored.map(toReport);
  if (!winner || !winner.buffer) {
    if (opts.force && !opts.dryRun && isStoredCover(book.cover_url)) {
      try {
        await clearStoredCover(admin, book.id);
        return { status: "no-candidate", candidates: report, cleared: true };
      } catch (error) {
        logError("Cover pipeline failed to clear a stored cover", error, {
          bookId: book.id,
        });
        return {
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
          candidates: report,
        };
      }
    }
    return { status: "no-candidate", candidates: report };
  }

  const source = sourceOf(winner.url);
  const width = winner.width as number;
  const height = winner.height as number;

  if (opts.dryRun) {
    return {
      status: "stored",
      coverUrl: winner.url,
      source,
      width,
      height,
      candidates: report,
    };
  }

  try {
    const coverUrl = await storeCover(admin, book.id, winner.buffer);
    const update: Database["public"]["Tables"]["books"]["Update"] = {
      cover_url: coverUrl,
      cover_source: source,
    };
    // Any passing Open Library candidate reveals the cover id, even when a
    // wider Google image wins; keep it so the row is fully identified.
    const discoveredId = scored.find((c) => c.ok && c.openLibraryCoverId)
      ?.openLibraryCoverId;
    if (discoveredId && !book.open_library_cover_id) {
      update.open_library_cover_id = discoveredId;
    }
    const { data, error } = await admin
      .from("books")
      .update(update)
      .eq("id", book.id)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("book row not found");
    }
    return {
      status: "stored",
      coverUrl,
      source,
      width,
      height,
      candidates: report,
    };
  } catch (error) {
    logError("Cover pipeline failed", error, { bookId: book.id });
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      candidates: report,
    };
  }
}
