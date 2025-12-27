import { tool, jsonSchema } from "ai";
import { createPublicClient } from "@/lib/supabase/server";

// Define schemas using jsonSchema helper
const searchBooksSchema = jsonSchema<{
  query?: string;
  genres?: string[];
  vibes?: string[];
  minRating?: number;
  limit?: number;
}>({
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Text search for title or author (optional)",
    },
    genres: {
      type: "array",
      items: { type: "string" },
      description:
        "Filter by genres like 'Fantasy', 'Mystery', 'Romance', 'Science Fiction', etc.",
    },
    vibes: {
      type: "array",
      items: { type: "string" },
      description:
        "Filter by vibe tags like 'cozy', 'dark', 'page-turner', 'atmospheric', etc.",
    },
    minRating: {
      type: "number",
      description: "Minimum average rating (1-5)",
    },
    limit: {
      type: "number",
      description: "Maximum number of results to return",
      default: 10,
    },
  },
});

const searchExternalBooksSchema = jsonSchema<{
  query: string;
  searchType?: "author" | "title" | "general";
  limit?: number;
}>({
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Search query - author name, book title, or keywords",
    },
    searchType: {
      type: "string",
      enum: ["author", "title", "general"],
      description:
        "Type of search: 'author' for books BY an author, 'title' for specific book title, 'general' for keyword/mood search. Default is 'general'.",
    },
    limit: {
      type: "number",
      description: "Maximum number of results to return",
      default: 5,
    },
  },
  required: ["query"],
});

const getBookDetailsSchema = jsonSchema<{
  slug?: string;
  id?: string;
}>({
  type: "object",
  properties: {
    slug: {
      type: "string",
      description: "Book slug (URL-friendly identifier)",
    },
    id: {
      type: "string",
      description: "Book UUID",
    },
  },
});

/**
 * Search books in our catalog by criteria
 */
export const searchBooksTool = tool({
  description:
    "Search for books in the OhMyReads catalog. Use this to find books matching user criteria like genres, vibes, or text search.",
  inputSchema: searchBooksSchema,
  execute: async (params) => {
    const { query, genres, vibes, minRating, limit = 10 } = params;
    const supabase = createPublicClient();

    let bookQuery = supabase
      .from("books")
      .select(
        "id, title, author, slug, description, cover_url, genres, average_rating, ratings_count"
      )
      .order("ratings_count", { ascending: false, nullsFirst: false })
      .limit(limit);

    // Text search on title/author
    if (query && query.trim()) {
      const sanitized = query.replace(/[%_(),."'\\]/g, "");
      bookQuery = bookQuery.or(
        `title.ilike.%${sanitized}%,author.ilike.%${sanitized}%`
      );
    }

    // Genre filter - match any of the specified genres
    if (genres && genres.length > 0) {
      bookQuery = bookQuery.overlaps("genres", genres);
    }

    // Minimum rating filter
    if (minRating && minRating > 0) {
      bookQuery = bookQuery.gte("average_rating", minRating);
    }

    const { data: books, error } = await bookQuery;

    if (error) {
      console.error("Error searching books:", error);
      return { success: false, error: "Failed to search books", books: [] };
    }

    const results = (books || []).map((book) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      slug: book.slug,
      description: book.description?.slice(0, 300) || "No description available",
      coverUrl: book.cover_url,
      genres: book.genres || [],
      rating: book.average_rating,
      ratingsCount: book.ratings_count,
    }));

    return {
      success: true,
      count: results.length,
      books: results,
      searchCriteria: { query, genres, vibes, minRating },
    };
  },
});

/**
 * Search external book APIs (Google Books) for books not in our catalog
 */
export const searchExternalBooksTool = tool({
  description:
    "Search external book databases (Google Books) for books not in our catalog. Use this when the internal catalog doesn't have enough matches. IMPORTANT: Use searchType='author' when searching for books BY an author, searchType='title' for specific titles.",
  inputSchema: searchExternalBooksSchema,
  execute: async (params) => {
    const { query, searchType = "general", limit = 5 } = params;
    try {
      // Format query based on search type
      let formattedQuery = query;
      if (searchType === "author") {
        // Use inauthor: to find books BY this author
        formattedQuery = `inauthor:${query}`;
      } else if (searchType === "title") {
        // Use intitle: to find books with this title
        formattedQuery = `intitle:${query}`;
      }

      // Fetch more results than needed to filter non-English books
      const fetchLimit = Math.min(limit * 3, 15);
      const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
        formattedQuery
      )}&maxResults=${fetchLimit}&printType=books&langRestrict=en`;

      const response = await fetch(googleUrl, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return {
          success: false,
          error: "Failed to search external books",
          books: [],
        };
      }

      const data = await response.json();

      interface GoogleBookItem {
        id: string;
        volumeInfo?: {
          title?: string;
          authors?: string[];
          description?: string;
          language?: string;
          imageLinks?: {
            thumbnail?: string;
          };
          categories?: string[];
          publishedDate?: string;
          pageCount?: number;
        };
      }

      const books = (data.items || [])
        // Filter to English only (backup filter in case API doesn't filter correctly)
        .filter((item: GoogleBookItem) => {
          const lang = item.volumeInfo?.language;
          return !lang || lang === "en";
        })
        .slice(0, limit)
        .map((item: GoogleBookItem) => {
          const info = item.volumeInfo || {};
          return {
            externalId: item.id,
            title: info.title || "Unknown Title",
            author: (info.authors || []).join(", ") || "Unknown Author",
            description:
              info.description?.slice(0, 300) || "No description available",
            coverUrl:
              info.imageLinks?.thumbnail?.replace("http:", "https:") || null,
            genres: info.categories || [],
            publishedDate: info.publishedDate || null,
            pageCount: info.pageCount || null,
            source: "google_books" as const,
          };
        });

      return {
        success: true,
        count: books.length,
        books,
        note: "These are external results not yet in our catalog.",
      };
    } catch (error) {
      console.error("Error searching external books:", error);
      return {
        success: false,
        error: "Failed to search external books",
        books: [],
      };
    }
  },
});

/**
 * Get details for a specific book by slug
 */
export const getBookDetailsTool = tool({
  description:
    "Get full details for a specific book in our catalog by its slug or ID",
  inputSchema: getBookDetailsSchema,
  execute: async (params) => {
    const { slug, id } = params;
    if (!slug && !id) {
      return { success: false, error: "Either slug or id is required" };
    }

    const supabase = createPublicClient();

    let query = supabase.from("books").select("*");

    if (slug) {
      query = query.eq("slug", slug);
    } else if (id) {
      query = query.eq("id", id);
    }

    const { data: book, error } = await query.single();

    if (error || !book) {
      return { success: false, error: "Book not found" };
    }

    return {
      success: true,
      book: {
        id: book.id,
        title: book.title,
        author: book.author,
        slug: book.slug,
        description: book.description,
        coverUrl: book.cover_url,
        genres: book.genres || [],
        rating: book.average_rating,
        ratingsCount: book.ratings_count,
        pageCount: book.page_count,
        publishedDate: book.published_date,
      },
    };
  },
});

/**
 * All available tools for the book search AI
 */
export const bookSearchTools = {
  searchBooks: searchBooksTool,
  searchExternalBooks: searchExternalBooksTool,
  getBookDetails: getBookDetailsTool,
};
