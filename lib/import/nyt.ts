/**
 * NYT Books API: bestseller list snapshots (catalog launch, Task 4).
 *
 * `fetchOverview(date)` returns every entry on every list published on (or
 * nearest to) a date, flattened. The pure helpers turn NYT's shouting titles
 * and "X. Illustrated by Y" author strings into catalog values and map list
 * names onto the site's genre vocabulary.
 *
 * Limits: 5 requests/minute, 500/day. Pacing between calls is the caller's
 * job; a 429 is retried once here after `retryDelayMs`.
 */

const OVERVIEW_URL = "https://api.nytimes.com/svc/books/v3/lists/overview.json";

export interface NytEntry {
  /** `list_name_encoded`, e.g. `hardcover-fiction` */
  listName: string;
  listDisplayName: string;
  /** The list's publication date (ISO, Sunday) */
  publishedDate: string;
  rank: number;
  /** As published: ALL CAPS */
  title: string;
  /** As published, may carry an illustrator suffix */
  author: string;
  primaryIsbn13: string | null;
  description: string | null;
  weeksOnList: number;
}

export interface NytOverview {
  publishedDate: string;
  entries: NytEntry[];
}

export class NytApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "NytApiError";
  }
}

export interface FetchOverviewOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  /** Wait before the single retry after a 429 (default 60 s) */
  retryDelayMs?: number;
}

interface RawBook {
  title?: string;
  author?: string;
  primary_isbn13?: string;
  isbns?: Array<{ isbn13?: string }>;
  description?: string;
  /** Ignored on purpose: the NYT API terms forbid caching its content, so it is never a cover candidate. */
  book_image?: string;
  rank?: number;
  weeks_on_list?: number;
}

interface RawList {
  list_name_encoded?: string;
  display_name?: string;
  books?: RawBook[];
}

interface RawOverview {
  status?: string;
  results?: {
    published_date?: string;
    lists?: RawList[];
  };
}

function isbn13Of(book: RawBook): string | null {
  const primary = book.primary_isbn13?.trim();
  if (primary && /^\d{13}$/.test(primary)) return primary;
  const fallback = book.isbns?.find((i) => i.isbn13 && /^\d{13}$/.test(i.isbn13));
  return fallback?.isbn13 ?? null;
}

/** Flattens an overview response into entries. Tolerates missing fields. */
export function parseOverview(json: unknown): NytOverview {
  const raw = (json ?? {}) as RawOverview;
  const publishedDate = raw.results?.published_date ?? "";
  const entries: NytEntry[] = [];
  for (const list of raw.results?.lists ?? []) {
    const listName = list.list_name_encoded ?? "";
    for (const book of list.books ?? []) {
      if (!book.title || !book.author) continue;
      entries.push({
        listName,
        listDisplayName: list.display_name ?? listName,
        publishedDate,
        rank: book.rank ?? 0,
        title: book.title.trim(),
        author: book.author.trim(),
        primaryIsbn13: isbn13Of(book),
        description: book.description?.trim() || null,
        weeksOnList: book.weeks_on_list ?? 0,
      });
    }
  }
  return { publishedDate, entries };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One overview snapshot. `date` is `YYYY-MM-DD`; NYT returns the list
 * published on or nearest after that date.
 */
export async function fetchOverview(
  date: string,
  opts: FetchOverviewOptions
): Promise<NytOverview> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = new URL(OVERVIEW_URL);
  url.searchParams.set("published_date", date);
  url.searchParams.set("api-key", opts.apiKey);

  let response = await fetchImpl(url.toString());
  if (response.status === 429) {
    await sleep(opts.retryDelayMs ?? 60_000);
    response = await fetchImpl(url.toString());
  }
  if (!response.ok) {
    throw new NytApiError(`NYT overview ${date}: HTTP ${response.status}`, response.status);
  }
  return parseOverview(await response.json());
}

// ============================================
// DATES
// ============================================

/** First Sunday of each month from `from` to `to` inclusive (`YYYY-MM`). */
export function firstSundays(from: string, to: string): string[] {
  const parse = (ym: string): [number, number] => {
    const m = /^(\d{4})-(\d{2})$/.exec(ym);
    if (!m) throw new Error(`Expected YYYY-MM, got "${ym}"`);
    return [Number(m[1]), Number(m[2]) - 1];
  };
  const [fy, fm] = parse(from);
  const [ty, tm] = parse(to);
  const out: string[] = [];
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 11 ? (y++, m = 0) : m++) {
    const first = new Date(Date.UTC(y, m, 1));
    const offset = (7 - first.getUTCDay()) % 7;
    const sunday = new Date(Date.UTC(y, m, 1 + offset));
    out.push(sunday.toISOString().slice(0, 10));
  }
  return out;
}

// ============================================
// TEXT CLEANUP
// ============================================

const BOX_SET = /box(ed)? set|collection|omnibus|\b\d+ books?\b|\bvol(ume)?\.?\s*\d+/i;

/** Multi-volume products and numbered serial volumes (manga), not one book. */
export function isBoxSet(title: string): boolean {
  return BOX_SET.test(title);
}

const EDITION_SUFFIX =
  /\s*[(\[][^)\]]*\b(edition|full-cast|unabridged|abridged|anniversary|tie-in|illustrated|deluxe|expanded|updated|revised)\b[^)\]]*[)\]]\s*$/i;

/**
 * "HARRY POTTER AND THE GOBLET OF FIRE (FULL-CAST EDITION)" → the title
 * without the edition note, so editions collapse onto one catalog row.
 */
export function stripEditionSuffix(title: string): string {
  return title.replace(EDITION_SUFFIX, "").trim();
}

const SMALL_WORDS = new Set([
  "a", "an", "the", "and", "but", "or", "nor", "for", "of", "on", "at", "to",
  "by", "in", "as", "vs", "via",
]);

/**
 * NYT publishes titles in capitals. Lower-cases them and re-capitalises each
 * word except articles and short prepositions (kept at the start, the end and
 * after a colon). Only the first letter of a word is touched, so "DON'T"
 * becomes "Don't" and "MOTHER-DAUGHTER" becomes "Mother-Daughter".
 */
export function titleCase(raw: string): string {
  const words = raw.trim().toLowerCase().split(/\s+/);
  return words
    .map((word, i) => {
      const afterColon = i > 0 && /:$/.test(words[i - 1]);
      const keepSmall =
        SMALL_WORDS.has(word.replace(/[^a-z]/g, "")) &&
        i !== 0 &&
        i !== words.length - 1 &&
        !afterColon;
      if (keepSmall) return word;
      return word
        .split("-")
        .map((part) => part.replace(/^([^a-z]*)([a-z])/, (_, lead, c) => lead + c.toUpperCase()))
        .join("-");
    })
    .join(" ");
}

/**
 * "Adam Rubin. Illustrated by Daniel Salmieri" → "Adam Rubin";
 * "by Emily Henry" → "Emily Henry". Co-authors ("X and Y") are kept.
 */
export function cleanAuthor(raw: string): string {
  return raw
    .replace(/^(written\s+)?by\s+/i, "")
    .replace(/[.,;]?\s*(with\s+)?illustrat(ed|ions)\s+by\b.*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/[.\s]+$/, "")
    .trim();
}

// ============================================
// LIST → GENRES
// ============================================

// Values must be entries of the genre vocabulary (lib/data/genres.ts).
const LIST_GENRES: Array<[RegExp, string[]]> = [
  [/nonfiction/, ["Non-Fiction"]],
  [/advice-how-to/, ["Self-Help", "Non-Fiction"]],
  [/young-adult/, ["Young Adult"]],
  [/childrens|picture-books|middle-grade|series-books/, ["Children"]],
  [/graphic-books|manga/, ["Graphic Novel"]],
  [/business/, ["Business", "Non-Fiction"]],
  [/science/, ["Science", "Non-Fiction"]],
  [/sports/, ["Sports", "Non-Fiction"]],
  [/travel/, ["Travel", "Non-Fiction"]],
  [/food-and-fitness/, ["Cooking", "Health", "Non-Fiction"]],
  [/health/, ["Health", "Non-Fiction"]],
  [/humor/, ["Humor"]],
  [/crime-and-punishment/, ["True Crime", "Non-Fiction"]],
  [/espionage/, ["Thriller"]],
  [/religion/, ["Religion", "Non-Fiction"]],
  [/politic/, ["Politics", "Non-Fiction"]],
  [/race-and-civil-rights/, ["Social Science", "Non-Fiction"]],
  [/celebrities/, ["Biography", "Non-Fiction"]],
  [/expeditions/, ["Adventure", "Non-Fiction"]],
  [/animals/, ["Non-Fiction"]],
  [/culture/, ["Social Science", "Non-Fiction"]],
  [/education/, ["Social Science", "Non-Fiction"]],
  [/family|relationships/, ["Self-Help", "Non-Fiction"]],
  [/fashion/, ["Non-Fiction"]],
  [/games-and-activities/, ["Non-Fiction"]],
  [/indigenous-americans/, ["History", "Non-Fiction"]],
  [/fiction|mass-market/, ["Fiction"]],
];

/** Site genres implied by an NYT list name (`list_name_encoded`). */
export function listGenres(listName: string): string[] {
  for (const [pattern, genres] of LIST_GENRES) {
    if (pattern.test(listName)) return genres;
  }
  return [];
}
