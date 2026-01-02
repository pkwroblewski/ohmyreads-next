import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Calendar, FileText, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBookBySlug,
  getBookReviews,
  getRelatedBooks,
  getUserBookStatus,
} from "@/lib/queries/books";
import { hasUserReviewedBook } from "@/lib/queries/reviews";
import { getSimilarBookRecommendations } from "@/lib/queries/recommendations";
import { BookListHorizontal } from "@/components/books/book-list-horizontal";
import { RecommendedBooksRow } from "@/components/books/recommended-books-row";
import { AddToShelfButton } from "@/components/books/add-to-shelf-button";
import { ShareButton } from "@/components/books/share-button";
import { RatingDisplay } from "@/components/ui/rating-display";
import { EmptyState } from "@/components/ui/empty-state";
import { ReviewForm } from "@/components/reviews/review-form";
import { ReviewCard } from "@/components/reviews/review-card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { safeJsonLd } from "@/lib/utils/jsonld";

interface Props {
  params: Promise<{ slug: string }>;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const book = await getBookBySlug(slug);

  if (!book) {
    return { title: "Book Not Found" };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ohmyreads.com";
  const ogImageUrl = `${baseUrl}/api/og/book?slug=${encodeURIComponent(slug)}`;

  return {
    title: `${book.title} by ${book.author}`,
    description:
      book.description?.slice(0, 160) ||
      `Read reviews and track ${book.title} by ${book.author} on OhMyReads.`,
    keywords: [
      book.title,
      book.author,
      ...book.genres,
      "book review",
      "reading",
    ],
    openGraph: {
      title: `${book.title} by ${book.author}`,
      description: book.description?.slice(0, 160),
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${book.title} by ${book.author}`,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${book.title} by ${book.author}`,
      description: book.description?.slice(0, 160),
      images: [ogImageUrl],
    },
  };
}

// Generate static params for popular books
export async function generateStaticParams() {
  try {
    const supabase = createAdminClient();
    const { data: books } = await supabase
      .from("books")
      .select("slug")
      .order("ratings_count", { ascending: false })
      .limit(100);
    
    return (books || []).map((book) => ({ slug: book.slug }));
  } catch (error) {
    console.error("Error in generateStaticParams:", error);
    return [];
  }
}

export default async function BookPage({ params }: Props) {
  const { slug } = await params;

  // Fetch book first
  const book = await getBookBySlug(slug);

  if (!book) {
    notFound();
  }

  // Get user if logged in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch related data in parallel
  const [reviews, relatedBooks, similarRecs, userBookStatus, userReviewCheck] = await Promise.all([
    getBookReviews(book.id),
    getRelatedBooks(book.genres, book.id),
    getSimilarBookRecommendations(book.id, user?.id || null, 6),
    user ? getUserBookStatus(user.id, book.id) : Promise.resolve(null),
    user ? hasUserReviewedBook(user.id, book.id) : Promise.resolve({ hasReviewed: false, review: null }),
  ]);

  const { hasReviewed, review: userExistingReview } = userReviewCheck;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ohmyreads.com";

  // Book JSON-LD Schema
  const bookJsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    author: { "@type": "Person", name: book.author },
    description: book.description,
    image: book.cover_url,
    isbn: book.isbn,
    numberOfPages: book.page_count,
    datePublished: book.published_date,
    genre: book.genres,
    url: `${baseUrl}/books/${book.slug}`,
    aggregateRating: book.average_rating
      ? {
          "@type": "AggregateRating",
          ratingValue: book.average_rating,
          reviewCount: book.ratings_count,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined,
    review: reviews.slice(0, 5).map((review) => ({
      "@type": "Review",
      author: {
        "@type": "Person",
        name: review.profile?.display_name || review.profile?.username || "Anonymous",
      },
      datePublished: review.created_at,
      reviewBody: review.summary || review.content?.substring(0, 500),
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
    })),
  };

  // Breadcrumb JSON-LD Schema
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Books",
        item: `${baseUrl}/books`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: book.title,
        item: `${baseUrl}/books/${book.slug}`,
      },
    ],
  };

  return (
    <>
      {/* JSON-LD for SEO - Book Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(bookJsonLd) }}
      />
      {/* JSON-LD for SEO - Breadcrumb Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />

      {/* Page Content */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        {/* ========================================
            Book Header Section
            ======================================== */}
        <section className="flex flex-col md:flex-row gap-8 mb-12">
          {/* Book Cover */}
          <div className="md:w-72 flex-shrink-0 mx-auto md:mx-0">
            <div
              className={cn(
                "relative w-72 rounded-xl overflow-hidden shadow-warm-lg",
                "bg-gradient-to-br from-muted to-muted-foreground/20"
              )}
              style={{ aspectRatio: "2/3" }}
            >
              {book.cover_url ? (
                <Image
                  src={book.cover_url}
                  alt={book.title}
                  fill
                  className="object-cover"
                  sizes="288px"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <BookOpen className="w-16 h-16 text-muted-foreground/50 mb-4" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {book.title}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Book Info */}
          <div className="flex-1">
            {/* Title */}
            <h1 className="text-3xl sm:text-4xl font-bold font-serif mb-2">
              {book.title}
            </h1>

            {/* Author */}
            <p className="text-xl text-muted-foreground mb-4">
              by{" "}
              <span className="text-foreground hover:text-primary transition-colors cursor-pointer">
                {book.author}
              </span>
            </p>

            {/* Rating */}
            {book.average_rating !== null && (
              <div className="flex items-center gap-2 mb-4">
                <RatingDisplay
                  rating={book.average_rating}
                  count={book.ratings_count}
                  size="lg"
                />
                <span className="font-medium">{book.average_rating.toFixed(1)}</span>
              </div>
            )}

            {/* Genres */}
            {book.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {book.genres.map((genre) => (
                  <Link
                    key={genre}
                    href={`/books?genre=${encodeURIComponent(genre)}`}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-full",
                      "bg-muted text-muted-foreground",
                      "hover:bg-primary/10 hover:text-primary transition-colors"
                    )}
                  >
                    {genre}
                  </Link>
                ))}
              </div>
            )}

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
              {book.page_count && (
                <div className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  <span>{book.page_count} pages</span>
                </div>
              )}
              {book.published_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Published {formatDate(book.published_date)}</span>
                </div>
              )}
              {book.isbn && (
                <div className="flex items-center gap-1">
                  <span className="text-xs">ISBN: {book.isbn}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Add to Shelf Button */}
              {user ? (
                <AddToShelfButton
                  bookId={book.id}
                  currentStatus={userBookStatus?.status}
                />
              ) : (
                <Link href={`/login?redirect=/books/${book.slug}`}>
                  <Button>Add to Shelf</Button>
                </Link>
              )}

              {/* Write Review Button */}
              {user ? (
                <a href="#reviews">
                  <Button variant="outline">Write Review</Button>
                </a>
              ) : (
                <Link href={`/login?redirect=/books/${book.slug}#reviews`}>
                  <Button variant="outline">Sign in to Review</Button>
                </Link>
              )}

              {/* Share Button */}
              <ShareButton title={book.title} slug={book.slug} />
            </div>
          </div>
        </section>

        {/* ========================================
            Description Section
            ======================================== */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold font-serif mb-4">
            About this book
          </h2>
          {book.description ? (
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {book.description}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground italic">
              No description available.
            </p>
          )}
        </section>

        {/* ========================================
            Reviews Section
            ======================================== */}
        <section id="reviews" className="mb-12 scroll-mt-20">
          <h2 className="text-xl font-semibold font-serif mb-6">
            Reviews ({reviews.length})
          </h2>

          {/* Review Form - show if user is logged in and hasn't reviewed yet */}
          {user && !hasReviewed && (
            <div className="mb-8 p-6 rounded-xl border border-border bg-card">
              <ReviewForm bookId={book.id} bookTitle={book.title} />
            </div>
          )}

          {/* Show user's existing review at top if they have one */}
          {user && hasReviewed && userExistingReview && (
            <div className="mb-8">
              <p className="text-sm text-muted-foreground mb-3">Your review:</p>
              <ReviewCard
                review={{
                  ...userExistingReview,
                  profile: undefined,
                }}
                currentUserId={user.id}
                isAuthenticated={true}
              />
            </div>
          )}

          {/* Reviews List */}
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews
                .filter((review) => !user || review.user_id !== user.id)
                .map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={{
                      ...review,
                      profile: review.profile || undefined,
                    }}
                    currentUserId={user?.id}
                    isAuthenticated={!!user}
                  />
                ))}
            </div>
          ) : !hasReviewed ? (
            <EmptyState
              icon={Star}
              title="No reviews yet"
              description="Be the first to share your thoughts about this book."
              action={
                user
                  ? undefined
                  : {
                      label: "Sign in to review",
                      href: `/login?redirect=/books/${book.slug}`,
                    }
              }
            />
          ) : null}
        </section>

        {/* ========================================
            Personalized Recommendations Section
            ======================================== */}
        {similarRecs.length > 0 && (
          <section className="mb-12">
            <RecommendedBooksRow
              books={similarRecs}
              title={user ? "Readers like you also enjoyed" : "Readers also enjoyed"}
            />
          </section>
        )}

        {/* ========================================
            Related Books Section (fallback if no recs)
            ======================================== */}
        {similarRecs.length === 0 && relatedBooks.length > 0 && (
          <section>
            <BookListHorizontal
              title="You might also like"
              books={relatedBooks}
              emptyMessage="No related books found"
            />
          </section>
        )}
      </div>
    </>
  );
}
