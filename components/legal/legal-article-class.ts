/**
 * Tailwind classes for the long-form legal pages (privacy, terms).
 *
 * The project does not ship @tailwindcss/typography, so `prose` is a no-op
 * and Preflight strips every default heading, list and table style. These
 * arbitrary variants restore a readable hierarchy without a plugin.
 */
export const LEGAL_ARTICLE_CLASS = [
  "max-w-none leading-relaxed",
  "[&_h1]:font-serif [&_h1]:text-4xl [&_h1]:font-bold [&_h1]:mb-2",
  "[&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-3",
  "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2",
  "[&_p]:my-3",
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2",
  "[&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-primary",
  "[&_table]:w-full [&_table]:my-4 [&_table]:text-sm [&_table]:border-collapse",
  "[&_th]:text-left [&_th]:align-top [&_th]:p-2 [&_th]:border-b [&_th]:border-border [&_th]:font-semibold",
  "[&_td]:align-top [&_td]:p-2 [&_td]:border-b [&_td]:border-border",
].join(" ");
