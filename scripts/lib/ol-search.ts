/**
 * Open Library search API as an import source (catalog launch, Task 5).
 *
 * `searchWorksBySubject` asks `search.json` for the most-read English works
 * of a subject (or award), with the English edition Open Library considers
 * best, so each work arrives with a title in English, an ISBN and a cover
 * id. Responses are cached under node_modules/.cache/ohmyreads/ol-search
 * because a subject query takes several seconds.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { isBoxSet, titleCase } from "../../lib/import/nyt";
import { type ImportCandidate } from "./import-core";

const SEARCH_URL = "https://openlibrary.org/search.json";
const TRENDING_URL = "https://openlibrary.org/trending/weekly.json";
const CACHE_DIR = join("node_modules", ".cache", "ohmyreads", "ol-search");
const USER_AGENT = "OhMyReads/1.0 (https://ohmyreads-next.vercel.app; catalog import)";
const FIELDS = [
  "key",
  "title",
  "author_name",
  "author_key",
  "first_publish_year",
  "cover_i",
  "isbn",
  "language",
  "readinglog_count",
  "number_of_pages_median",
  "subject",
  "editions",
  "editions.key",
  "editions.title",
  "editions.isbn",
  "editions.cover_i",
  "editions.language",
].join(",");

export interface WorkDoc {
  key: string; // "/works/OL123W"
  title: string;
  author_name?: string[];
  author_key?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  language?: string[];
  readinglog_count?: number;
  number_of_pages_median?: number;
  subject?: string[];
  editions?: {
    docs?: Array<{
      key: string;
      title?: string;
      isbn?: string[];
      cover_i?: number;
      language?: string[];
    }>;
  };
}

interface SearchResponse {
  numFound?: number;
  docs?: WorkDoc[];
}

async function fetchJson(url: string): Promise<SearchResponse> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`Open Library ${response.status} for ${url}`);
  return (await response.json()) as SearchResponse;
}

// Subject queries take seconds and sometimes time out; one retry after a pause.
async function fetchWithRetry(url: string): Promise<SearchResponse> {
  try {
    return await fetchJson(url);
  } catch (first) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    try {
      return await fetchJson(url);
    } catch {
      throw first;
    }
  }
}

async function cached(name: string, url: string): Promise<SearchResponse> {
  const file = join(CACHE_DIR, `${name}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const data = await fetchWithRetry(url);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(data));
  return data;
}

/** Most-read English works tagged with a subject (OL subject key or words). */
export async function searchWorksBySubject(subject: string, limit: number): Promise<WorkDoc[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("subject", subject);
  url.searchParams.set("language", "eng");
  url.searchParams.set("sort", "readinglog");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("fields", FIELDS);
  const data = await cached(`subject-${subject.replace(/[^a-z0-9_-]/gi, "_")}-${limit}-v2`, url.toString());
  return data.docs ?? [];
}

/** This week's trending works (same document shape as search). */
export async function fetchTrendingWorks(limit: number): Promise<WorkDoc[]> {
  const url = new URL(TRENDING_URL);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("fields", FIELDS);
  const week = new Date().toISOString().slice(0, 10);
  const data = await cached(`trending-${week}-${limit}-v2`, url.toString());
  return data.docs ?? [];
}

export type SkipReason = "no-author" | "no-year" | "box-set" | "no-english-edition" | "no-title";

// Latin script (with accents); Open Library lists some authors in their
// native script first ("刘慈欣" before "Cixin Liu").
const LATIN = /^[\u0020-\u024F\u1E00-\u1EFF\u2010-\u2027]+$/;

const authorNames = new Map<string, Promise<string | null>>();

/** Author records say "Tolstoy, Leo" and "Homer."; the catalog says "Leo Tolstoy". */
function displayName(name: string): string {
  const trimmed = name.trim().replace(/[.]+$/, "");
  const inverted = /^([^,]+),[ ]*(.+)$/.exec(trimmed);
  return inverted ? `${inverted[2]} ${inverted[1]}`.trim() : trimmed;
}

/**
 * The primary author's name in Latin script. `author_name[0]` is the primary
 * author but may be in their native script ("刘慈欣"); the other entries are
 * translators, so the author record (`/authors/{key}.json`, cached) is asked
 * for its Latin name instead.
 */
async function latinAuthor(doc: WorkDoc): Promise<string | null> {
  const primary = doc.author_name?.[0]?.trim();
  if (!primary) return null;
  if (LATIN.test(primary)) return primary;
  const key = doc.author_key?.[0];
  if (!key) return null;
  if (!authorNames.has(key)) {
    authorNames.set(
      key,
      (async () => {
        try {
          const data = (await cached(`author-${key}`, `https://openlibrary.org/authors/${key}.json`)) as {
            name?: string;
            personal_name?: string;
            alternate_names?: string[];
          };
          const names = [data.name, data.personal_name, ...(data.alternate_names ?? [])];
          const latin = names.find((n): n is string => Boolean(n) && LATIN.test(n as string));
          return latin ? displayName(latin) : null;
        } catch {
          return null;
        }
      })()
    );
  }
  return authorNames.get(key) as Promise<string | null>;
}

// ISBN-13s from the English-language registration groups (978-0, 978-1,
// 979-8): a foreign edition's ISBN would pull a foreign cover.
function englishIsbn(isbns: string[] | undefined): string | null {
  const clean = (isbns ?? []).map((i) => i.replace(/[^0-9Xx]/g, ""));
  return clean.find((i) => /^(978[01]|9798)\d{9}$/.test(i)) ?? null;
}

/** "Love medicine" → "Love Medicine"; titles that already carry capitals are kept. */
function tidyTitle(title: string): string {
  const rest = title.slice(1);
  return /[A-Z]/.test(rest) ? title : titleCase(title);
}

/**
 * A search document as an import candidate. The English edition supplies the
 * title, ISBN and cover when the work record is in another language.
 */
export async function workToCandidate(
  doc: WorkDoc,
  genres: string[]
): Promise<{ candidate: ImportCandidate } | { skip: SkipReason }> {
  const author = await latinAuthor(doc);
  if (!author) return { skip: "no-author" };
  if (!doc.first_publish_year) return { skip: "no-year" };
  const edition = doc.editions?.docs?.find((e) => e.language?.includes("eng"));
  const workIsEnglish = !doc.language || doc.language.includes("eng");
  if (!edition && !workIsEnglish) return { skip: "no-english-edition" };
  const rawTitle = (edition?.title ?? doc.title)?.trim();
  if (!rawTitle) return { skip: "no-title" };
  // A work record in another script whose English edition carries no title
  if (!LATIN.test(rawTitle)) return { skip: "no-english-edition" };
  if (isBoxSet(rawTitle)) return { skip: "box-set" };
  const title = tidyTitle(rawTitle);
  return {
    candidate: {
      title,
      author,
      isbn: englishIsbn(edition?.isbn) ?? englishIsbn(doc.isbn),
      genres,
      subjects: doc.subject ?? [],
      openLibraryId: doc.key.replace("/works/", ""),
      openLibraryCoverId: edition?.cover_i ?? doc.cover_i ?? null,
      publishedDate: `${doc.first_publish_year}-01-01`,
      pageCount: doc.number_of_pages_median ?? null,
    },
  };
}
