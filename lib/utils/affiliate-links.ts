/**
 * Generate affiliate purchase links for books
 * Supports Amazon and Bol.com
 */

interface BookForLinks {
  isbn?: string | null;
  title: string;
  author: string;
}

export interface AffiliateLinks {
  amazon: string;
  bolcom: string;
}

// Get Amazon affiliate tag from env or use default
const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG || "";

/**
 * Generate affiliate links for a book
 * Uses ISBN if available, otherwise searches by title + author
 */
export function getAffiliateLinks(book: BookForLinks): AffiliateLinks {
  // Build search query: prefer ISBN, fallback to title + author
  const searchQuery = book.isbn
    ? book.isbn.replace(/-/g, "") // Remove hyphens from ISBN
    : `${book.title} ${book.author}`.trim();

  const encodedQuery = encodeURIComponent(searchQuery);

  // Amazon search URL with optional affiliate tag
  const amazonUrl = AMAZON_TAG
    ? `https://www.amazon.com/s?k=${encodedQuery}&tag=${AMAZON_TAG}`
    : `https://www.amazon.com/s?k=${encodedQuery}`;

  // Bol.com search URL (Dutch book retailer)
  const bolcomUrl = `https://www.bol.com/nl/nl/s/?searchtext=${encodedQuery}`;

  return {
    amazon: amazonUrl,
    bolcom: bolcomUrl,
  };
}
