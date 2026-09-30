// How a spine looks, from the book's data alone: lettering family by genre,
// width by page count, height by genre plus a stable per-title jitter, and
// colours from the stored cover colours with genre fallbacks.
// Ported from the approved prototype (.claude/prototypes/shelf/shelf.template.html).

export type LetteringFamily =
  | "classic"
  | "fantasy"
  | "literary"
  | "scifi"
  | "thriller"
  | "light"
  | "fact";

const FAMILY: Record<string, LetteringFamily> = {
  Classics: "classic",
  Poetry: "classic",
  "Short Stories": "classic",
  Fantasy: "fantasy",
  "Historical Fiction": "fantasy",
  Adventure: "fantasy",
  "Literary Fiction": "literary",
  Fiction: "literary",
  Contemporary: "literary",
  "Science Fiction": "scifi",
  Dystopian: "scifi",
  "Hugo Award": "scifi",
  Thriller: "thriller",
  Crime: "thriller",
  Mystery: "thriller",
  Horror: "thriller",
  Paranormal: "thriller",
  Romance: "light",
  "Young Adult": "light",
  Humor: "light",
  Children: "light",
  "Graphic Novel": "light",
};

export function letteringFamily(genre: string | null | undefined): LetteringFamily {
  return (genre && FAMILY[genre]) || "fact";
}

/** Spine colour for books with no cover colour. */
const GENRE_COLOUR: Record<LetteringFamily, string> = {
  classic: "#6b2a2a",
  fantasy: "#2f4a3a",
  literary: "#e8e2d4",
  scifi: "#1f3550",
  thriller: "#161616",
  light: "#e0a33a",
  fact: "#f0efe9",
};

/** Typical height as a share of the shelf; thrillers are small paperbacks. */
const TALL: Record<LetteringFamily, number> = {
  classic: 0.9,
  fantasy: 0.93,
  literary: 0.88,
  scifi: 0.86,
  thriller: 0.8,
  light: 0.84,
  fact: 0.87,
};

/** Rough advance per character (in ems) for each lettering style. */
export const PER_CHAR: Record<LetteringFamily, number> = {
  classic: 0.78,
  fantasy: 0.5,
  literary: 0.52,
  scifi: 0.82,
  thriller: 0.6,
  light: 0.55,
  fact: 0.7,
};

/** Serif families have no width axis, so they never narrow. */
export function canNarrow(family: LetteringFamily): boolean {
  return family !== "classic" && family !== "fantasy" && family !== "literary";
}

/** FNV-1a hash mapped to [0, 1), so a book gets the same height every render. */
export function stableHash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 2 ** 32;
}

/** Spine width in px at full scale: 1 px per 24 pages, 18-64 px. */
export function spineWidth(pageCount: number | null | undefined): number {
  const pages = pageCount && pageCount > 0 ? pageCount : 280;
  return Math.round(Math.min(64, Math.max(18, 12 + pages / 24)));
}

/** Spine height as a whole percentage of the shelf height. */
export function spineHeightPct(family: LetteringFamily, title: string): number {
  return Math.round((TALL[family] - 0.08 + stableHash(title) * 0.1) * 100);
}

function rgb(hex: string | null | undefined): [number, number, number] | null {
  const m = hex?.match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Background and lettering colours. The stored ink is used only when it
 * reads against the stored colour (3:1, the large-text minimum); otherwise
 * near-black or near-white, whichever the background needs.
 */
export function spineColours(
  family: LetteringFamily,
  spineColor: string | null | undefined,
  spineInk: string | null | undefined
): { bg: string; text: string } {
  const bgRgb = rgb(spineColor);
  const bg = bgRgb ? spineColor! : GENRE_COLOUR[family];
  const base = bgRgb ?? rgb(bg)!;
  const ink = rgb(spineInk);
  const text =
    ink && contrast(ink, base) >= 3 ? spineInk! : luminance(base) > 0.35 ? "#15161a" : "#f6f3ec";
  return { bg, text };
}

/** Title as printed on a spine: the part before a subtitle or series note. */
export function spineTitle(title: string): string {
  return title.split(/[:(]/)[0].trim() || title;
}

/** A leading article the fitter may drop before it truncates. */
export function withoutArticle(title: string): string | null {
  const m = title.match(/^(?:the|a|an)\s+(.+)$/i);
  return m ? m[1] : null;
}

/** Last name of the first author, for the foot of the spine. */
export function authorSurname(author: string | null | undefined): string {
  return (author || "").split(",")[0].trim().split(/\s+/).pop() || "";
}

/**
 * Server-side first guess at the title size, so the shelf looks right before
 * the client fitter runs. Mirrors the prototype's estimate.
 */
export function initialTitleFit(
  family: LetteringFamily,
  title: string,
  width: number,
  heightPct: number
): { size: number; stretch: number } {
  const avail = 188 * (heightPct / 100) * 0.62;
  const perChar = PER_CHAR[family];
  let size = Math.min(width * 0.5, 16, avail / (title.length * perChar));
  let stretch = 100;
  if (size < 9 && canNarrow(family)) {
    stretch = Math.max(62, Math.round((100 * size) / 9));
    size = Math.min(width * 0.5, avail / ((title.length * perChar * stretch) / 100));
  }
  return { size: Math.round(Math.max(size, 6.5) * 10) / 10, stretch };
}
