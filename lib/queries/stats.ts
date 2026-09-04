import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/utils/log";

// PostgREST caps a single response at 1000 rows and gives no signal that it
// truncated, so any "all of a user's rows" read has to page explicitly.
const PAGE_SIZE = 1000;

async function fetchAllPages<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<{ rows: T[]; error: unknown }> {
  const rows: T[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await buildQuery(offset, offset + PAGE_SIZE - 1);
    if (error) return { rows, error };

    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return { rows, error: null };
  }
}

export interface ReadingStats {
  totalBooksRead: number;
  totalPagesRead: number;
  totalReviews: number;
  averageRating: number;
  booksThisYear: number;
  pagesThisYear: number;
  booksThisMonth: number;
  averageDaysToFinish: number;
  averagePagesPerDay: number;
  fastestBook: { title: string; days: number } | null;
  slowestBook: { title: string; days: number } | null;
  shortestBook: {
    title: string;
    slug: string;
    pages: number;
    cover_url: string | null;
  } | null;
  longestBook: {
    title: string;
    slug: string;
    pages: number;
    cover_url: string | null;
  } | null;
  oldestBook: {
    title: string;
    slug: string;
    year: number;
    cover_url: string | null;
  } | null;
  newestBook: {
    title: string;
    slug: string;
    year: number;
    cover_url: string | null;
  } | null;
  highestRated: {
    title: string;
    slug: string;
    rating: number;
    cover_url: string | null;
  } | null;
  ratingDistribution: { rating: number; count: number }[];
  genreDistribution: { genre: string; count: number; percentage: number }[];
  monthlyReading: { month: string; books: number; pages: number }[];
  yearlyReading: { year: number; books: number; pages: number }[];
  topAuthors: { author: string; count: number }[];
  topGenres: { genre: string; count: number }[];
  yearlyGoal: number | null;
  yearlyProgress: number;
}

interface UserBookWithDetails {
  id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  book: {
    id: string;
    title: string;
    slug: string;
    author: string;
    page_count: number | null;
    published_date: string | null;
    genres: string[];
    cover_url: string | null;
  } | null;
}

export async function getUserReadingStats(
  userId: string
): Promise<ReadingStats> {
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  // The stats page genuinely needs every read book (per-month buckets, genre
  // mix, page totals), so this pages through instead of aggregating in SQL.
  // A single select truncated at PostgREST's 1000-row cap, silently
  // under-reporting every figure for a heavy reader.
  const { rows: userBooks, error } = await fetchAllPages<UserBookWithDetails>(
    (from, to) =>
      supabase
        .from("user_books")
        .select(
          `
          id,
          status,
          started_at,
          finished_at,
          created_at,
          book:books(
            id,
            title,
            slug,
            author,
            page_count,
            published_date,
            genres,
            cover_url
          )
        `
        )
        .eq("user_id", userId)
        .eq("status", "read")
        .order("finished_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
        .overrideTypes<UserBookWithDetails[], { merge: false }>()
  );

  if (error) {
    logError("Error fetching user books", error);
    return getEmptyStats();
  }

  // Get user's reviews (paged for the same reason as above)
  const { rows: reviews } = await fetchAllPages<{ rating: number | null; book_id: string }>(
    (from, to) =>
      supabase
        .from("reviews")
        .select("rating, book_id")
        .eq("user_id", userId)
        .order("id", { ascending: true })
        .range(from, to)
  );

  // Get user's reading goal
  const { data: goalData } = await supabase
    .from("reading_goals")
    .select("target_books")
    .eq("user_id", userId)
    .eq("year", currentYear)
    .single();

  const books = userBooks;
  const reviewsData = reviews;

  // Calculate core metrics
  const totalBooksRead = books.length;
  const totalPagesRead = books.reduce(
    (sum, ub) => sum + (ub.book?.page_count || 0),
    0
  );
  const totalReviews = reviewsData.length;
  const ratedReviews = reviewsData.filter((r) => r.rating != null);
  const averageRating =
    ratedReviews.length > 0
      ? Math.round(
          (ratedReviews.reduce((sum, r) => sum + r.rating!, 0) /
            ratedReviews.length) *
            10
        ) / 10
      : 0;

  // Time-based calculations
  const booksThisYear = books.filter((ub) => {
    const finishedYear = ub.finished_at
      ? new Date(ub.finished_at).getFullYear()
      : null;
    return finishedYear === currentYear;
  }).length;

  const pagesThisYear = books
    .filter((ub) => {
      const finishedYear = ub.finished_at
        ? new Date(ub.finished_at).getFullYear()
        : null;
      return finishedYear === currentYear;
    })
    .reduce((sum, ub) => sum + (ub.book?.page_count || 0), 0);

  const booksThisMonth = books.filter((ub) => {
    if (!ub.finished_at) return false;
    const finished = new Date(ub.finished_at);
    return (
      finished.getFullYear() === currentYear &&
      finished.getMonth() === currentMonth
    );
  }).length;

  // Calculate reading pace
  const booksWithDates = books.filter((ub) => ub.started_at && ub.finished_at);
  const readingDurations = booksWithDates.map((ub) => {
    const start = new Date(ub.started_at!);
    const end = new Date(ub.finished_at!);
    const days = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    );
    return { book: ub.book, days };
  });

  const averageDaysToFinish =
    readingDurations.length > 0
      ? Math.round(
          readingDurations.reduce((sum, r) => sum + r.days, 0) /
            readingDurations.length
        )
      : 0;

  const totalDaysReading = readingDurations.reduce((sum, r) => sum + r.days, 0);
  const averagePagesPerDay =
    totalDaysReading > 0 ? Math.round(totalPagesRead / totalDaysReading) : 0;

  // Find fastest and slowest books
  const sortedByDuration = [...readingDurations].sort(
    (a, b) => a.days - b.days
  );
  const fastestBook = sortedByDuration[0]
    ? {
        title: sortedByDuration[0].book?.title || "",
        days: sortedByDuration[0].days,
      }
    : null;
  const slowestBook = sortedByDuration[sortedByDuration.length - 1]
    ? {
        title: sortedByDuration[sortedByDuration.length - 1].book?.title || "",
        days: sortedByDuration[sortedByDuration.length - 1].days,
      }
    : null;

  // Find extreme books
  const booksWithPages = books.filter((ub) => ub.book?.page_count);
  const sortedByPages = [...booksWithPages].sort(
    (a, b) => (a.book?.page_count || 0) - (b.book?.page_count || 0)
  );

  const shortestBookEntry = sortedByPages[0];
  const shortestBook = shortestBookEntry?.book
    ? {
        title: shortestBookEntry.book.title,
        slug: shortestBookEntry.book.slug,
        pages: shortestBookEntry.book.page_count!,
        cover_url: shortestBookEntry.book.cover_url,
      }
    : null;
  const longestBookEntry = sortedByPages[sortedByPages.length - 1];
  const longestBook = longestBookEntry?.book
    ? {
        title: longestBookEntry.book.title,
        slug: longestBookEntry.book.slug,
        pages: longestBookEntry.book.page_count!,
        cover_url: longestBookEntry.book.cover_url,
      }
    : null;

  // Find oldest and newest by publication date
  const booksWithPubDate = books.filter((ub) => ub.book?.published_date);
  const sortedByPubDate = [...booksWithPubDate].sort((a, b) => {
    const dateA = new Date(a.book!.published_date!);
    const dateB = new Date(b.book!.published_date!);
    return dateA.getTime() - dateB.getTime();
  });

  const oldestBookEntry = sortedByPubDate[0];
  const oldestBook = oldestBookEntry?.book
    ? {
        title: oldestBookEntry.book.title,
        slug: oldestBookEntry.book.slug,
        year: new Date(oldestBookEntry.book.published_date!).getFullYear(),
        cover_url: oldestBookEntry.book.cover_url,
      }
    : null;
  const newestBookEntry = sortedByPubDate[sortedByPubDate.length - 1];
  const newestBook = newestBookEntry?.book
    ? {
        title: newestBookEntry.book.title,
        slug: newestBookEntry.book.slug,
        year: new Date(newestBookEntry.book.published_date!).getFullYear(),
        cover_url: newestBookEntry.book.cover_url,
      }
    : null;

  // Find highest rated by user (exclude null ratings)
  const reviewMap = new Map(
    reviewsData.filter((r) => r.rating != null).map((r) => [r.book_id, r.rating!])
  );
  const booksWithRatings = books
    .filter((ub) => reviewMap.has(ub.book?.id ?? ""))
    .map((ub) => ({ ...ub, userRating: reviewMap.get(ub.book?.id ?? "")! }))
    .sort((a, b) => b.userRating - a.userRating);

  const highestRated = booksWithRatings[0]?.book
    ? {
        title: booksWithRatings[0].book.title,
        slug: booksWithRatings[0].book.slug,
        rating: booksWithRatings[0].userRating,
        cover_url: booksWithRatings[0].book.cover_url,
      }
    : null;

  // Rating distribution (only count non-null ratings)
  const ratingCounts = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: ratedReviews.filter((r) => r.rating === rating).length,
  }));

  // Genre distribution
  const genreCounts = new Map<string, number>();
  books.forEach((ub) => {
    (ub.book?.genres || []).forEach((genre) => {
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
    });
  });
  const totalGenreEntries = Array.from(genreCounts.values()).reduce(
    (a, b) => a + b,
    0
  );
  const genreDistribution = Array.from(genreCounts.entries())
    .map(([genre, count]) => ({
      genre,
      count,
      percentage:
        totalGenreEntries > 0
          ? Math.round((count / totalGenreEntries) * 100)
          : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Monthly reading (last 12 months)
  const monthlyReading: { month: string; books: number; pages: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthName = date.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });

    const monthBooks = books.filter((ub) => {
      if (!ub.finished_at) return false;
      const finished = new Date(ub.finished_at);
      return finished.getFullYear() === year && finished.getMonth() === month;
    });

    monthlyReading.push({
      month: monthName,
      books: monthBooks.length,
      pages: monthBooks.reduce(
        (sum, ub) => sum + (ub.book?.page_count || 0),
        0
      ),
    });
  }

  // Yearly reading (all years)
  const yearCounts = new Map<number, { books: number; pages: number }>();
  books.forEach((ub) => {
    if (!ub.finished_at) return;
    const year = new Date(ub.finished_at).getFullYear();
    const existing = yearCounts.get(year) || { books: 0, pages: 0 };
    yearCounts.set(year, {
      books: existing.books + 1,
      pages: existing.pages + (ub.book?.page_count || 0),
    });
  });
  const yearlyReading = Array.from(yearCounts.entries())
    .map(([year, data]) => ({ year, ...data }))
    .sort((a, b) => a.year - b.year);

  // Top authors
  const authorCounts = new Map<string, number>();
  books.forEach((ub) => {
    if (ub.book?.author) {
      authorCounts.set(
        ub.book.author,
        (authorCounts.get(ub.book.author) || 0) + 1
      );
    }
  });
  const topAuthors = Array.from(authorCounts.entries())
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top genres
  const topGenres = genreDistribution
    .slice(0, 5)
    .map((g) => ({ genre: g.genre, count: g.count }));

  return {
    totalBooksRead,
    totalPagesRead,
    totalReviews,
    averageRating,
    booksThisYear,
    pagesThisYear,
    booksThisMonth,
    averageDaysToFinish,
    averagePagesPerDay,
    fastestBook,
    slowestBook,
    shortestBook,
    longestBook,
    oldestBook,
    newestBook,
    highestRated,
    ratingDistribution: ratingCounts,
    genreDistribution,
    monthlyReading,
    yearlyReading,
    topAuthors,
    topGenres,
    yearlyGoal: goalData?.target_books || null,
    yearlyProgress: booksThisYear,
  };
}

function getEmptyStats(): ReadingStats {
  return {
    totalBooksRead: 0,
    totalPagesRead: 0,
    totalReviews: 0,
    averageRating: 0,
    booksThisYear: 0,
    pagesThisYear: 0,
    booksThisMonth: 0,
    averageDaysToFinish: 0,
    averagePagesPerDay: 0,
    fastestBook: null,
    slowestBook: null,
    shortestBook: null,
    longestBook: null,
    oldestBook: null,
    newestBook: null,
    highestRated: null,
    ratingDistribution: [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: 0 })),
    genreDistribution: [],
    monthlyReading: [],
    yearlyReading: [],
    topAuthors: [],
    topGenres: [],
    yearlyGoal: null,
    yearlyProgress: 0,
  };
}
