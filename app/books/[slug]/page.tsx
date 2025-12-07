import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Calendar, FileText, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getBookBySlug,
  getBookReviews,
  getRelatedBooks,
  getUserBookStatus,
  getPopularBooks,
} from "@/lib/queries/books";
import { BookListHorizontal } from "@/components/books/book-list-horizontal";
import { AddToShelfButton } from "@/components/books/add-to-shelf-button";
import { ShareButton } from "@/components/books/share-button";
import { RatingDisplay } from "@/components/ui/rating-display";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

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
      images: book.cover_url ? [book.cover_url] : [],
      type: "website",
    },
  };
}

// Generate static params for popular books
export async function generateStaticParams() {
  const books = await getPopularBooks(100);
  return books.map((book) => ({ slug: book.slug }));
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
  const [reviews, relatedBooks, userBookStatus] = await Promise.all([
    getBookReviews(book.id),
    getRelatedBooks(book.genres, book.id),
    user ? getUserBookStatus(user.id, book.id) : Promise.resolve(null),
  ]);

  return (
    <>
      {/* JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
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
            aggregateRating: book.average_rating
              ? {
                  "@type": "AggregateRating",
                  ratingValue: book.average_rating,
                  reviewCount: book.ratings_count,
                }
              : undefined,
          }),
        }}
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
              {user && (
                <Button variant="outline" asChild>
                  <a href="#reviews">Write Review</a>
                </Button>
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

          {/* Review Form Placeholder */}
          {user && (
            <div className="mb-8 p-6 rounded-xl border border-border bg-card">
              <p className="text-muted-foreground text-center">
                Review form coming soon...
              </p>
            </div>
          )}

          {/* Reviews List */}
          {reviews.length > 0 ? (
            <div className="space-y-6">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="p-6 rounded-xl border border-border bg-card"
                >
                  {/* Review Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-medium">
                        {review.profile?.display_name?.[0] ||
                          review.profile?.username?.[0] ||
                          "U"}
                      </div>
                      <div>
                        <p className="font-medium">
                          {review.profile?.display_name ||
                            review.profile?.username ||
                            "Anonymous"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(review.created_at)}
                        </p>
                      </div>
                    </div>
                    <RatingDisplay
                      rating={review.rating}
                      size="sm"
                      showCount={false}
                    />
                  </div>

                  {/* Spoiler Warning */}
                  {review.is_spoiler && (
                    <div className="mb-3 px-3 py-1 rounded bg-destructive/10 text-destructive text-sm inline-block">
                      Contains spoilers
                    </div>
                  )}

                  {/* Review Content */}
                  <p className="text-muted-foreground whitespace-pre-line">
                    {review.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
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
          )}
        </section>

        {/* ========================================
            Related Books Section
            ======================================== */}
        {relatedBooks.length > 0 && (
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
