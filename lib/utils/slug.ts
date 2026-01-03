/**
 * Generate a URL-safe slug from a title or string
 * Centralized utility to ensure consistent slug generation across the codebase
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}
