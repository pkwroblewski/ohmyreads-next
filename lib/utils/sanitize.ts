/**
 * Sanitize a value for safe use in PostgREST .or() filter strings.
 * Removes characters that have structural meaning in PostgREST syntax.
 *
 * PostgREST uses specific characters for query structure:
 * - `.` as field/operator separator (e.g., `field.ilike.%value%`)
 * - `,` as filter separator (e.g., `filter1,filter2`)
 * - `(` and `)` for grouping
 *
 * Removing these prevents query manipulation while preserving search functionality.
 *
 * @param value - The user-provided search string
 * @returns Sanitized string safe for use in PostgREST filters
 *
 * @example
 * sanitizePostgrestValue("normal search") // "normal search"
 * sanitizePostgrestValue("malicious.ilike,admin") // "maliciousilikeadmin"
 */
export function sanitizePostgrestValue(value: string): string {
  // Remove PostgREST structural characters that could alter filter parsing
  return value.replace(/[.,()]/g, '');
}
