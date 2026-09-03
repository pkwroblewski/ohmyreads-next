import { z } from "zod";

/**
 * Valid sort options for book search
 */
export const SORT_OPTIONS = ["popular", "newest", "rating", "title"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/**
 * Valid genre options for filtering
 * These match the genres available in the book submission form and UI
 */
export const GENRE_OPTIONS = [
  "Fiction",
  "Non-Fiction",
  "Mystery",
  "Thriller",
  "Romance",
  "Science Fiction",
  "Fantasy",
  "Horror",
  "Biography",
  "History",
  "Self-Help",
  "Business",
  "Science",
  "Philosophy",
  "Poetry",
  "Classics",
  "Young Adult",
  "Children",
  "Graphic Novel",
  "Memoir",
] as const;
export type GenreOption = (typeof GENRE_OPTIONS)[number];

/**
 * Search query parameter validation schema
 */
export const searchParamsSchema = z.object({
  q: z
    .string()
    .max(200, "Search query too long")
    .transform((val) => val.trim())
    .transform((val) => val.replace(/[%_(),."'\\]/g, "")) // Remove PostgREST special characters
    .default(""),
  genre: z
    .string()
    .refine((val) => GENRE_OPTIONS.includes(val as GenreOption), {
      message: `Invalid genre. Valid options: ${GENRE_OPTIONS.join(", ")}`,
    })
    .optional()
    .nullable(),
  sort: z
    .enum(SORT_OPTIONS, {
      message: `Invalid sort option. Valid options: ${SORT_OPTIONS.join(", ")}`,
    })
    .default("popular"),
  page: z.coerce
    .number()
    .int("Page must be an integer")
    .min(1, "Page must be at least 1")
    .default(1),
  limit: z.coerce
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(50, "Limit cannot exceed 50")
    .default(20),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;

/**
 * The browse state `/books` accepts from its URL (server-rendered seed for
 * the client island). `genre` must be one the page actually offers — the DB
 * genre list, which is what genre links elsewhere point at — and anything
 * else falls back to the unfiltered view so the canonical stays honest.
 */
export function parseBrowseParams(
  raw: { q?: string; genre?: string; sort?: string },
  genres: readonly string[]
): { q: string; genre: string | null; sort: SortOption } {
  const q = (raw.q ?? "").trim().slice(0, 200);
  const genre = raw.genre && genres.includes(raw.genre) ? raw.genre : null;
  const sort = SORT_OPTIONS.includes(raw.sort as SortOption)
    ? (raw.sort as SortOption)
    : "popular";
  return { q, genre, sort };
}

/**
 * Parse and validate search parameters from URLSearchParams
 */
export function parseSearchParams(searchParams: URLSearchParams): {
  success: true;
  data: SearchParams;
} | {
  success: false;
  error: string;
} {
  const raw = {
    q: searchParams.get("q") ?? undefined,
    genre: searchParams.get("genre"),
    sort: searchParams.get("sort") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  };

  const result = searchParamsSchema.safeParse(raw);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return {
      success: false,
      error: `${firstIssue.path.join(".")}: ${firstIssue.message}`,
    };
  }

  return { success: true, data: result.data };
}
