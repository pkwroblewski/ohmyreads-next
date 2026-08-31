/**
 * Helpers for admin list pages, whose filters live in the URL rather than in
 * component state. Keeping them in the URL is what makes those pages
 * shareable, back-button-friendly and server-renderable.
 *
 * Pure functions with no React or Next imports, so the server page and the
 * client filter islands can both use them.
 */

/** What `searchParams` gives a page, once awaited. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/** The current filters as a flat string map, which is what the islands take. */
export type AdminParams = Record<string, string>;

/** Collapse Next's `string | string[] | undefined` into a flat string map. */
export function toAdminParams(raw: RawSearchParams): AdminParams {
  const params: AdminParams = {};
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined && first !== "") {
      params[key] = first;
    }
  }
  return params;
}

/**
 * Build a query string with `updates` applied over `current`.
 *
 * A value of `""` or `undefined` drops the key, so a filter reset back to its
 * default leaves the URL clean instead of accumulating `?isAdmin=all`.
 */
export function buildAdminQuery(
  current: AdminParams,
  updates: Record<string, string | number | undefined>
): string {
  const next = new URLSearchParams(current);

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === "") {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  }

  const query = next.toString();
  return query ? `?${query}` : "";
}

/** Read a positive integer param, falling back when absent or malformed. */
export function readPage(params: AdminParams, fallback = 1): number {
  const parsed = Number.parseInt(params.page ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Read a param constrained to a known set. Anything else falls back, so a
 * hand-edited URL cannot push an unexpected value into a query.
 */
export function readEnum<T extends string>(
  params: AdminParams,
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  const value = params[key];
  return allowed.includes(value as T) ? (value as T) : fallback;
}
