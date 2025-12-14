/**
 * Safe JSON-LD serialization to prevent XSS attacks.
 * 
 * JSON.stringify does NOT escape "</script>" which allows attackers
 * to break out of a <script type="application/ld+json"> tag if they
 * control any string values (e.g., book titles, user bios).
 * 
 * This helper escapes all "<" characters as "\u003c" which is valid JSON
 * and prevents script tag injection.
 */

/**
 * Safely serialize an object for use in a JSON-LD script tag.
 * Escapes characters that could break out of the script context.
 * 
 * @param obj - The object to serialize
 * @returns A safe JSON string for use in dangerouslySetInnerHTML
 * 
 * @example
 * ```tsx
 * <script
 *   type="application/ld+json"
 *   dangerouslySetInnerHTML={{ __html: safeJsonLd(bookSchema) }}
 * />
 * ```
 */
export function safeJsonLd(obj: unknown): string {
  const json = JSON.stringify(obj);
  
  // Replace characters that could break out of script context:
  // - "<" prevents "</script>" injection
  // - ">" for additional safety
  // - "&" prevents HTML entity attacks
  // Using Unicode escapes which are valid in JSON
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

/**
 * Helper to create a JSON-LD script element props object.
 * This is a convenience wrapper around safeJsonLd.
 * 
 * @param obj - The structured data object
 * @returns Props object for a script element
 * 
 * @example
 * ```tsx
 * <script {...jsonLdScriptProps(bookSchema)} />
 * ```
 */
export function jsonLdScriptProps(obj: unknown): {
  type: string;
  dangerouslySetInnerHTML: { __html: string };
} {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: safeJsonLd(obj) },
  };
}

