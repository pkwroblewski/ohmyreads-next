/**
 * The staff shelf: books picked by hand, not by an algorithm. Shown as the
 * homepage hero shelf and used as the "Curated" fallback for readers with
 * no taste signals yet. Order here is shelf order. Approved by the owner
 * 2026-09-30; edit freely, a slug missing from the catalog is skipped.
 */
export const STAFF_PICK_SLUGS = [
  "dune",
  "nineteen-eighty-four",
  "the-road",
  "a-game-of-thrones",
  "things-fall-apart",
  "the-shining",
  "and-then-there-were-none",
  "the-kite-runner",
  "sapiens",
  "fahrenheit-451",
  "maus-i-a-survivor-s-tale-my-father-bleeds-history",
  "the-hunger-games",
  "le-comte-de-monte-cristo",
  "the-diary-of-a-young-girl",
  "brave-new-world",
  "the-silent-patient",
  "thinking-fast-and-slow",
  "the-seven-husbands-of-evelyn-hugo",
  "matilda",
  "the-odyssey-of-homer",
  "the-giver",
  "watchmen",
  "on-writing",
  "northern-lights",
];

/** Put rows in staff-shelf order (the database returns them in any order). */
export function inStaffOrder<T extends { slug: string }>(rows: T[]): T[] {
  const rank = new Map(STAFF_PICK_SLUGS.map((slug, i) => [slug, i]));
  return rows
    .filter((r) => rank.has(r.slug))
    .sort((a, b) => rank.get(a.slug)! - rank.get(b.slug)!);
}

/** The reason label on a staff pick, so callers can tell picks from personal recommendations. */
export const STAFF_PICK_REASON = "Staff pick";
