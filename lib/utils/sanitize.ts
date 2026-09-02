/**
 * Sanitize a value for safe use in PostgREST .or() filter strings.
 * Removes characters that have structural meaning in PostgREST syntax.
 *
 * PostgREST uses specific characters for query structure:
 * - `.` as field/operator separator (e.g., `field.ilike.%value%`)
 * - `,` as filter separator (e.g., `filter1,filter2`)
 * - `(` and `)` for grouping
 * - `"` and `'` for quoting values
 * - `\` as an escape character
 *
 * Also removes `%`, the LIKE "match anything" wildcard, so a crafted term
 * cannot turn a targeted search into a full-table match.
 *
 * `_` (the LIKE single-character wildcard) is deliberately NOT removed: its
 * only effect is benign over-matching, whereas stripping it would break search
 * for the many usernames that contain underscores (`user_1a2b`, `john_doe`).
 *
 * @param value - The user-provided search string
 * @returns Sanitized string safe for use in PostgREST filters
 *
 * @example
 * sanitizePostgrestValue("normal search") // "normal search"
 * sanitizePostgrestValue("malicious.ilike,admin") // "maliciousilikeadmin"
 * sanitizePostgrestValue("%") // ""
 * sanitizePostgrestValue("john_doe") // "john_doe"
 */
export function sanitizePostgrestValue(value: string): string {
  // Remove PostgREST structural/quoting characters and the % wildcard
  return value.replace(/[.,()"'\\%]/g, '');
}

/**
 * Escape a value for safe interpolation into an HTML document.
 *
 * Required for any user-controlled string placed into hand-built HTML that
 * React does not escape for us — notably the transactional email templates in
 * `lib/email/templates/`, which are raw template literals sent to Resend.
 *
 * @param value - The user-provided string
 * @returns String safe to interpolate into HTML text or attribute content
 *
 * @example
 * escapeHtml('<img src=x onerror=alert(1)>') // '&lt;img src=x onerror=alert(1)&gt;'
 * escapeHtml("O'Brien & Sons") // 'O&#39;Brien &amp; Sons'
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Return a user-supplied URL only when it is safe to use as an `href`.
 *
 * Anything that is not an absolute `http:` / `https:` URL — `javascript:`,
 * `data:`, `vbscript:`, scheme-less strings, garbage — comes back as
 * `undefined` so the caller can drop the link entirely. Validation rejects
 * these on the way in (`httpUrl` in `lib/validation/shared.ts`); this is the
 * render-time guard for rows that predate that check.
 *
 * @example
 * safeHref("https://example.com") // "https://example.com"
 * safeHref("javascript:alert(1)") // undefined
 * safeHref(null) // undefined
 */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}
