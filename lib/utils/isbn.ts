/**
 * Normalize an ISBN to the 13-digit form stored in `books.isbn`.
 * Strips hyphens and spaces and converts ISBN-10 to ISBN-13.
 * Returns null for blank or malformed input.
 */
export function normalizeIsbn(raw: string | null | undefined): string | null {
  const clean = (raw ?? "").replace(/[-\s]/g, "").toUpperCase();
  if (/^\d{13}$/.test(clean)) return clean;
  if (!/^\d{9}[\dX]$/.test(clean)) return null;

  const core = `978${clean.slice(0, 9)}`;
  const sum = [...core].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return `${core}${(10 - (sum % 10)) % 10}`;
}
