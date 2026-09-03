import { format, formatDistanceToNow } from "date-fns";

/**
 * Formats a date to "Jan 15, 2024" format
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy");
}

/**
 * Formats a date to relative time like "2 hours ago"
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Formats a number to compact format like "1.2k" or "15.3M"
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return num.toString();
}

/**
 * Truncates a string to specified length with "..."
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) {
    return str;
  }
  return `${str.slice(0, length).trim()}...`;
}

/**
 * Truncate for a meta description: cut at the last word boundary before
 * `length`, whitespace collapsed, with a single-character ellipsis so the
 * result never exceeds `length`. A hard `slice(0, 160)` ends snippets on a
 * half word, which is what search results used to show.
 */
export function truncateAtWord(str: string, length = 160): string {
  const text = str.replace(/\s+/g, " ").trim();
  if (text.length <= length) {
    return text;
  }
  const cut = text.slice(0, length - 1);
  // If the cut already lands on a word boundary, keep the whole word.
  const lastSpace = /\s/.test(text.charAt(length - 1))
    ? cut.length
    : cut.lastIndexOf(" ");
  const head = lastSpace > length / 2 ? cut.slice(0, lastSpace) : cut;
  return `${head.replace(/[\s,;:.!?-]+$/, "")}…`;
}

/**
 * Formats time remaining until expiration as "Xh Xm remaining"
 * Returns null if no expiration, "Expired" if past
 */
export function formatTimeRemaining(
  expiresAt: string | null,
  suffix: string = "remaining"
): string | null {
  if (!expiresAt) return null;
  const expireDate = new Date(expiresAt);
  const now = new Date();
  const diff = expireDate.getTime() - now.getTime();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m ${suffix}`;
  return `${minutes}m ${suffix}`;
}

