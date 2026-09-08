// @vitest-environment node
/**
 * Cover pipeline (Catalog launch, Task 1).
 *
 * Fixtures are generated with sharp so the tests measure real image bytes:
 * the pipeline must reject the Google placeholder by hash, anything under
 * 300 px, and non-portrait shapes; keep the widest survivor (earlier wins a
 * tie); skip books already on the bucket unless forced; and write the
 * winner's origin and any discovered Open Library cover id back to the row.
 */

import { createHash } from "crypto";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  collectCandidates,
  fetchAndScore,
  isStoredCover,
  pickBest,
  PLACEHOLDER_MD5,
  processBook,
  type ScoredCandidate,
} from "@/lib/covers/pipeline";

// libvips opens a thread pool the size of the machine on top of vitest's own
// worker per core; left alone it starves timing-sensitive component tests in
// other workers (quick-rating's 1 s waitFor). One thread is plenty here.
sharp.concurrency(1);

const BUCKET_URL =
  "https://bgczdbmqievfilvdzlgl.supabase.co/storage/v1/object/public/book-covers";
const BOOK_ID = "550e8400-e29b-41d4-a716-446655440000";

/** A "real" cover: noisy enough to encode like photographic artwork. */
async function image(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 80, b: 40 },
      noise: { type: "gaussian", mean: 128, sigma: 40 },
    },
  })
    .jpeg()
    .toBuffer();
}

/** A flat single-colour image: what a logo-on-white or grey placeholder encodes like. */
async function flatImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 245, g: 245, b: 245 } },
  })
    .jpeg()
    .toBuffer();
}

function imageResponse(buffer: Buffer, finalUrl?: string): Response {
  const response = new Response(new Blob([Uint8Array.from(buffer)]), {
    status: 200,
    headers: { "content-type": "image/jpeg" },
  });
  if (finalUrl) {
    Object.defineProperty(response, "url", { value: finalUrl });
  }
  return response;
}

function fakeFetch(routes: Record<string, () => Response>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const route = routes[url];
    return route ? route() : new Response(null, { status: 404 });
  }) as unknown as typeof fetch;
}

function fakeAdmin(updatedRows: { id: string }[] = [{ id: BOOK_ID }]) {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ data: [], error: null });
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `${BUCKET_URL}/${path}` },
  }));
  const select = vi.fn().mockResolvedValue({ data: updatedRows, error: null });
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  const admin = {
    storage: { from: vi.fn(() => ({ upload, getPublicUrl, remove })) },
    from,
  } as unknown as SupabaseClient<Database>;
  return { admin, upload, remove, update, eq, from };
}

describe("isStoredCover", () => {
  it("recognises only public book-covers objects on the project host", () => {
    expect(isStoredCover(`${BUCKET_URL}/${BOOK_ID}.jpg`)).toBe(true);
    expect(isStoredCover(`${BUCKET_URL}/${BOOK_ID}.jpg?v=123`)).toBe(true);
    expect(
      isStoredCover(
        "https://bgczdbmqievfilvdzlgl.supabase.co/storage/v1/object/public/place-photos/x.jpg"
      )
    ).toBe(false);
    expect(isStoredCover("https://covers.openlibrary.org/b/id/1-L.jpg")).toBe(
      false
    );
    expect(isStoredCover(null)).toBe(false);
    expect(isStoredCover("not a url")).toBe(false);
  });
});

describe("collectCandidates", () => {
  it("puts importer extras first, keeps the fallback chain, drops stored and duplicate URLs", () => {
    const urls = collectCandidates(
      {
        cover_url: `${BUCKET_URL}/${BOOK_ID}.jpg`,
        isbn: "9780735211292",
        google_books_id: "abc",
        open_library_cover_id: 42,
      },
      ["https://cdn.example.com/cover.jpg", "https://cdn.example.com/cover.jpg"]
    ).map((c) => c.url);

    expect(urls).toEqual([
      "https://cdn.example.com/cover.jpg",
      "https://covers.openlibrary.org/b/id/42.jpg?default=false",
      "https://covers.openlibrary.org/b/id/42-L.jpg?default=false",
      "https://covers.openlibrary.org/b/isbn/9780735211292.jpg?default=false",
      "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg?default=false",
      "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=3&source=gbs_api",
    ]);
  });

  it("refuses nyt.com hosts even when an importer offers them first", () => {
    const urls = collectCandidates({ cover_url: null, isbn: "9780735211292" }, [
      "https://static01.nyt.com/bestsellers/images/9780735211292.jpg",
      "https://nyt.com/x.jpg",
      "https://notnyt.com/x.jpg",
    ]).map((c) => c.url);
    expect(urls).toEqual([
      "https://notnyt.com/x.jpg",
      "https://covers.openlibrary.org/b/isbn/9780735211292.jpg?default=false",
      "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg?default=false",
    ]);
  });

  it("puts the original before an Open Library -M extra too, never before a non-OL URL", () => {
    const urls = collectCandidates({ cover_url: null }, [
      "https://covers.openlibrary.org/b/id/7-M.jpg",
      "https://books.google.com/books/content?id=x&zoom=3",
    ]).map((c) => c.url);
    expect(urls).toEqual([
      "https://covers.openlibrary.org/b/id/7.jpg",
      "https://covers.openlibrary.org/b/id/7-M.jpg",
      "https://books.google.com/books/content?id=x&zoom=3",
    ]);
  });
});

const originalFixture = await image(400, 600);

describe("fetchAndScore", () => {
  it("knows both Google placeholders: the 128 px zoom-1 and the 575 px zoom-3 one", () => {
    expect(PLACEHOLDER_MD5.has("e89e0e364e83c0ecfba5da41007c9a2c")).toBe(true);
    expect(PLACEHOLDER_MD5.has("a64fa89d7ebc97075c1d363fc5fea71f")).toBe(true);
  });

  it("rejects the Google placeholder by hash even though it is a valid image", async () => {
    const placeholder = await image(400, 600);
    const md5 = createHash("md5").update(placeholder).digest("hex");
    const result = await fetchAndScore("https://x/placeholder", {
      fetchImpl: fakeFetch({ "https://x/placeholder": () => imageResponse(placeholder) }),
      placeholderHashes: new Set([md5]),
    });
    expect(result).toMatchObject({ ok: false, reason: "placeholder" });
  });

  it("rejects a flat, near-empty image as low-detail even at full size", async () => {
    const flat = await flatImage(575, 863);
    const result = await fetchAndScore("https://x/flat", {
      fetchImpl: fakeFetch({ "https://x/flat": () => imageResponse(flat) }),
    });
    expect(result).toMatchObject({ ok: false, reason: "low-detail", width: 575 });
    expect((result.bytes ?? 0) / (575 * 863)).toBeLessThan(0.05);
  });

  it("measures detail at the stored size, so a 2,000 px flat-design original is not 'low-detail'", async () => {
    // Solid field plus a few hundred text-like strokes: 0.027 bytes/px at
    // 2000x3000 (under the 0.05 floor), 0.07 once resized to 800 px.
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let strokes = "";
    for (let i = 0; i < 400; i++) {
      strokes += `<rect x="${(rnd() * 1900) | 0}" y="${(rnd() * 2900) | 0}" width="${(20 + rnd() * 120) | 0}" height="${(6 + rnd() * 14) | 0}" fill="#f2c94c"/>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="3000"><rect width="2000" height="3000" fill="#7a1f1f"/>${strokes}</svg>`;
    const original = await sharp(Buffer.from(svg)).jpeg().toBuffer();
    expect(original.byteLength / (2000 * 3000)).toBeLessThan(0.05);

    const result = await fetchAndScore("https://x/original", {
      fetchImpl: fakeFetch({ "https://x/original": () => imageResponse(original) }),
    });
    expect(result).toMatchObject({ ok: true, width: 2000, height: 3000 });

    const flat = await flatImage(2000, 3000);
    const rejected = await fetchAndScore("https://x/flat-large", {
      fetchImpl: fakeFetch({ "https://x/flat-large": () => imageResponse(flat) }),
    });
    expect(rejected).toMatchObject({ ok: false, reason: "low-detail", width: 2000 });
  });

  it("accepts a narrow Open Library scan that is 500 px tall", async () => {
    const narrow = await image(295, 500);
    const result = await fetchAndScore("https://x/narrow", {
      fetchImpl: fakeFetch({ "https://x/narrow": () => imageResponse(narrow) }),
    });
    expect(result).toMatchObject({ ok: true, width: 295, height: 500 });
  });

  it("rejects a 128 px image as too small", async () => {
    const tiny = await image(128, 170);
    const result = await fetchAndScore("https://x/tiny", {
      fetchImpl: fakeFetch({ "https://x/tiny": () => imageResponse(tiny) }),
    });
    expect(result).toMatchObject({ ok: false, reason: "too-small", width: 128 });
  });

  it("rejects landscape shapes, 404s and non-images", async () => {
    const wide = await image(800, 400);
    const fetchImpl = fakeFetch({
      "https://x/wide": () => imageResponse(wide),
      "https://x/html": () =>
        new Response("<html/>", { status: 200, headers: { "content-type": "text/html" } }),
    });
    expect(await fetchAndScore("https://x/wide", { fetchImpl })).toMatchObject({
      ok: false,
      reason: "bad-aspect",
    });
    expect(await fetchAndScore("https://x/html", { fetchImpl })).toMatchObject({
      ok: false,
      reason: "not-image",
    });
    expect(await fetchAndScore("https://x/missing", { fetchImpl })).toMatchObject({
      ok: false,
      reason: "http-error",
    });
  });

  it("reads the Open Library cover id off an unsuffixed original URL", async () => {
    const result = await fetchAndScore(
      "https://covers.openlibrary.org/b/isbn/9780735211292.jpg?default=false",
      {
        fetchImpl: fakeFetch({
          "https://covers.openlibrary.org/b/isbn/9780735211292.jpg?default=false": () =>
            imageResponse(originalFixture, "https://covers.openlibrary.org/b/id/15239979.jpg"),
        }),
      }
    );
    expect(result.ok).toBe(true);
    expect(result.openLibraryCoverId).toBe(15239979);
  });

  it("reads the Open Library cover id off the redirected URL", async () => {
    const cover = await image(500, 750);
    const result = await fetchAndScore(
      "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg?default=false",
      {
        fetchImpl: fakeFetch({
          "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg?default=false":
            () => imageResponse(cover, "https://covers.openlibrary.org/b/id/8771-L.jpg"),
        }),
      }
    );
    expect(result).toMatchObject({ ok: true, width: 500, height: 750, openLibraryCoverId: 8771 });
  });
});

describe("User-Agent", () => {
  it("strips the CR-LF that pasted env values carry, so undici accepts the header", async () => {
    // .env values written by the Vercel CLI end in a literal CR-LF, which
    // Next's loader turns into real control characters. undici throws on a
    // header containing one, and every candidate came back "fetch-failed"
    // from a server action while the tsx scripts (dotenv) were unaffected.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000\r\n");
    vi.stubEnv("OPEN_LIBRARY_CONTACT", "");
    vi.resetModules();
    const fresh = await import("@/lib/covers/pipeline");

    const seen: string[] = [];
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      seen.push(String((init?.headers as Record<string, string>)["User-Agent"]));
      return new Response("nope", { status: 404 });
    }) as unknown as typeof fetch;

    await fresh.fetchAndScore("https://covers.openlibrary.org/b/id/1-L.jpg", { fetchImpl });

    expect(seen[0]).toBe("OhMyReads/1.0 (http://localhost:3000; contact via site)");
    vi.unstubAllEnvs();
  });
});

describe("pickBest", () => {
  const scored = (url: string, width?: number): ScoredCandidate =>
    width
      ? { url, finalUrl: url, ok: true, width, height: Math.round(width * 1.5) }
      : { url, finalUrl: url, ok: false, reason: "too-small" };

  it("takes the widest passing candidate", () => {
    expect(
      pickBest([scored("a", 400), scored("b"), scored("c", 700), scored("d", 500)])?.url
    ).toBe("c");
  });

  it("breaks a tie in favour of the earlier candidate", () => {
    expect(pickBest([scored("a"), scored("b", 500), scored("c", 500)])?.url).toBe("b");
  });

  it("returns undefined when nothing passed", () => {
    expect(pickBest([scored("a"), scored("b")])).toBeUndefined();
  });
});

describe("processBook", () => {
  const OL_ISBN =
    "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg?default=false";
  const OL_ISBN_ORIGINAL =
    "https://covers.openlibrary.org/b/isbn/9780735211292.jpg?default=false";
  const GOOGLE =
    "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=3&source=gbs_api";

  it("keeps the stored cover on a forced run with keepExisting when nothing passes", async () => {
    const { admin, remove, update } = fakeAdmin();
    const result = await processBook(
      admin,
      { id: BOOK_ID, isbn: "9780735211292", cover_url: `${BUCKET_URL}/${BOOK_ID}.jpg?v=1` },
      { force: true, keepExisting: true, fetchImpl: fakeFetch({}) }
    );
    expect(result).toMatchObject({ status: "no-candidate", kept: true });
    expect(result.status === "no-candidate" && result.cleared).toBeFalsy();
    expect(remove).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("stops fetching once a passing candidate is at least the stored width", async () => {
    const original = await image(1600, 2400);
    const fetchImpl = fakeFetch({
      [OL_ISBN_ORIGINAL]: () => imageResponse(original),
      [OL_ISBN]: () => imageResponse(original),
      [GOOGLE]: () => imageResponse(original),
    });
    const { admin, update } = fakeAdmin();

    const result = await processBook(
      admin,
      { id: BOOK_ID, isbn: "9780735211292", google_books_id: "abc", cover_url: null },
      { fetchImpl }
    );

    expect(result.status).toBe("stored");
    if (result.status !== "stored") return;
    expect(result.width).toBe(1600);
    expect(result.source).toBe("openlibrary");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.candidates.map((c) => c.url)).toEqual([OL_ISBN_ORIGINAL]);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ cover_source: "openlibrary" }));
  });

  it("falls through to -L and Google when the original is too small", async () => {
    const tiny = await image(200, 300);
    const large = await image(500, 750);
    const google = await image(800, 1200);
    const fetchImpl = fakeFetch({
      [OL_ISBN_ORIGINAL]: () => imageResponse(tiny),
      [OL_ISBN]: () => imageResponse(large),
      [GOOGLE]: () => imageResponse(google),
    });
    const { admin } = fakeAdmin();

    const result = await processBook(
      admin,
      { id: BOOK_ID, isbn: "9780735211292", google_books_id: "abc", cover_url: null },
      { fetchImpl }
    );

    expect(result.status).toBe("stored");
    if (result.status !== "stored") return;
    expect(result.source).toBe("google");
    expect(result.width).toBe(800);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result.candidates[0]).toMatchObject({ url: OL_ISBN_ORIGINAL, ok: false });
  });

  it("stores the sharpest candidate and writes url, source and discovered cover id", async () => {
    const olCover = await image(500, 750);
    const googleCover = await image(800, 1200);
    const { admin, upload, update, eq } = fakeAdmin();

    const result = await processBook(
      admin,
      { id: BOOK_ID, isbn: "9780735211292", google_books_id: "abc", cover_url: null },
      {
        fetchImpl: fakeFetch({
          [OL_ISBN]: () =>
            imageResponse(olCover, "https://covers.openlibrary.org/b/id/8771-L.jpg"),
          [GOOGLE]: () => imageResponse(googleCover),
        }),
      }
    );

    expect(result.status).toBe("stored");
    if (result.status !== "stored") return;
    expect(result.source).toBe("google");
    expect(result.width).toBe(800);
    expect(result.coverUrl).toMatch(
      new RegExp(`^${BUCKET_URL}/${BOOK_ID}\\.jpg\\?v=\\d+$`)
    );
    expect(isStoredCover(result.coverUrl)).toBe(true);

    expect(upload).toHaveBeenCalledWith(
      `${BOOK_ID}.jpg`,
      expect.any(Buffer),
      { upsert: true, contentType: "image/jpeg", cacheControl: "31536000" }
    );
    const stored = await sharp(upload.mock.calls[0][1] as Buffer).metadata();
    expect(stored.format).toBe("jpeg");
    expect(stored.width).toBe(800);

    expect(update).toHaveBeenCalledWith({
      cover_url: result.coverUrl,
      cover_source: "google",
      open_library_cover_id: 8771,
    });
    expect(eq).toHaveBeenCalledWith("id", BOOK_ID);
    expect(result.candidates.every((c) => !("buffer" in c))).toBe(true);
  });

  it("downsizes an oversized winner to 800 px and keeps the earlier source on a tie", async () => {
    const olCover = await image(1200, 1800);
    const googleCover = await image(1200, 1800);
    const { admin, upload, update } = fakeAdmin();

    const result = await processBook(
      admin,
      { id: BOOK_ID, isbn: "9780735211292", google_books_id: "abc" },
      {
        fetchImpl: fakeFetch({
          [OL_ISBN]: () => imageResponse(olCover),
          [GOOGLE]: () => imageResponse(googleCover),
        }),
      }
    );

    expect(result.status).toBe("stored");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ cover_source: "openlibrary" })
    );
    const stored = await sharp(upload.mock.calls[0][1] as Buffer).metadata();
    expect(stored.width).toBe(800);
  });

  it("skips a book whose cover is already on the bucket, unless forced", async () => {
    const cover = await image(600, 900);
    const storedUrl = `${BUCKET_URL}/${BOOK_ID}.jpg?v=1`;
    const fetchImpl = fakeFetch({ [OL_ISBN]: () => imageResponse(cover) });
    const { admin, upload, update } = fakeAdmin();
    const book = { id: BOOK_ID, isbn: "9780735211292", cover_url: storedUrl };

    expect(await processBook(admin, book, { fetchImpl })).toEqual({
      status: "skipped",
      reason: "already-stored",
      coverUrl: storedUrl,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();

    const forced = await processBook(admin, book, { fetchImpl, force: true });
    expect(forced.status).toBe("stored");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("leaves the row alone when every candidate is rejected", async () => {
    const tiny = await image(128, 170);
    const { admin, upload, update } = fakeAdmin();

    const result = await processBook(
      admin,
      { id: BOOK_ID, google_books_id: "abc", cover_url: "https://example.com/old.jpg" },
      { fetchImpl: fakeFetch({ [GOOGLE]: () => imageResponse(tiny) }) }
    );

    expect(result.status).toBe("no-candidate");
    if (result.status !== "no-candidate") return;
    expect(result.candidates.map((c) => c.reason)).toEqual(["http-error", "too-small"]);
    expect(upload).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("removes a stored cover that fails a forced re-verification", async () => {
    const flat = await flatImage(575, 863);
    const { admin, upload, remove, update } = fakeAdmin();
    const book = {
      id: BOOK_ID,
      google_books_id: "abc",
      cover_url: `${BUCKET_URL}/${BOOK_ID}.jpg?v=1`,
    };
    const fetchImpl = fakeFetch({ [GOOGLE]: () => imageResponse(flat) });

    // Without force the stored cover is trusted and nothing is fetched.
    expect((await processBook(admin, book, { fetchImpl })).status).toBe("skipped");

    const result = await processBook(admin, book, { fetchImpl, force: true });
    expect(result).toMatchObject({ status: "no-candidate", cleared: true });
    expect(remove).toHaveBeenCalledWith([`${BOOK_ID}.jpg`]);
    expect(update).toHaveBeenCalledWith({ cover_url: null, cover_source: null });
    expect(upload).not.toHaveBeenCalled();

    // A dry run reports the verdict but touches nothing.
    remove.mockClear();
    update.mockClear();
    const dry = await processBook(admin, book, { fetchImpl, force: true, dryRun: true });
    expect(dry).toMatchObject({ status: "no-candidate" });
    expect(dry).not.toHaveProperty("cleared");
    expect(remove).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("does not upload or update in dry-run mode but reports the would-be winner", async () => {
    const cover = await image(600, 900);
    const { admin, upload, update } = fakeAdmin();

    const result = await processBook(
      admin,
      { id: BOOK_ID, isbn: "9780735211292" },
      { fetchImpl: fakeFetch({ [OL_ISBN]: () => imageResponse(cover) }), dryRun: true }
    );

    expect(result).toMatchObject({ status: "stored", coverUrl: OL_ISBN, source: "openlibrary", width: 600 });
    expect(upload).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("reports a failure when the row update matches nothing", async () => {
    const cover = await image(600, 900);
    const { admin } = fakeAdmin([]);

    const result = await processBook(
      admin,
      { id: BOOK_ID, isbn: "9780735211292" },
      { fetchImpl: fakeFetch({ [OL_ISBN]: () => imageResponse(cover) }) }
    );

    expect(result).toMatchObject({ status: "failed", error: "book row not found" });
  });
});
