import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  BookOpen,
  BookMarked,
  Library,
  Star,
  Globe,
  Calendar,
} from "lucide-react";
import {
  getProfileByUsername,
  getUserStats,
  getUserBooks,
  getUserReviews,
  getSocialLinks,
} from "@/lib/queries/users";
import { SocialLinksDisplay } from "@/components/social/social-links-display";
import { BookCard } from "@/components/books/book-card";
import { RatingDisplay } from "@/components/ui/rating-display";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { truncate } from "@/lib/utils";

interface Props {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(username);

  if (!profile) {
    return { title: "User Not Found" };
  }

  const name = profile.display_name || profile.username;

  return {
    title: `${name} (@${profile.username})`,
    description: profile.bio || `See what ${name} is reading on OhMyReads`,
    openGraph: {
      title: `${name} on OhMyReads`,
      description: profile.bio || `Check out ${name}'s reading list`,
      images: profile.avatar_url ? [profile.avatar_url] : [],
    },
  };
}

export default async function UserProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const { tab } = await searchParams;
  const profile = await getProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  // Determine active tab
  const activeTab = tab || "all";
  const statusFilter =
    activeTab === "all"
      ? undefined
      : activeTab === "reading"
        ? "reading"
        : activeTab === "read"
          ? "read"
          : activeTab === "want"
            ? "want_to_read"
            : undefined;

  // Fetch data in parallel
  const [stats, booksResult, reviews, socialLinks] = await Promise.all([
    getUserStats(profile.id),
    getUserBooks(profile.id, { status: statusFilter, limit: 12 }),
    getUserReviews(profile.id, 5),
    getSocialLinks(profile.id),
  ]);

  const books = booksResult.userBooks;

  const displayName = profile.display_name || profile.username;
  const memberSince = format(new Date(profile.created_at), "MMMM yyyy");

  return (
    <>
      {/* JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: displayName,
            url: `${process.env.NEXT_PUBLIC_SITE_URL}/users/${profile.username}`,
            image: profile.avatar_url,
            description: profile.bio,
          }),
        }}
      />

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        {/* ========================================
            Profile Header
            ======================================== */}
        <section className="mb-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <Avatar className="h-24 w-24 sm:h-32 sm:w-32">
              {profile.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={displayName} />
              )}
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-3xl sm:text-4xl">
                {displayName[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold font-serif mb-1">
                {displayName}
              </h1>
              <p className="text-muted-foreground mb-3">@{profile.username}</p>

              {profile.bio && (
                <p className="text-muted-foreground mb-4 max-w-xl">
                  {profile.bio}
                </p>
              )}

              {/* Links & Meta */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-muted-foreground">
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    <Globe className="h-4 w-4" />
                    Website
                  </a>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Member since {memberSince}
                </span>
              </div>

              {/* Social Links */}
              {socialLinks.length > 0 && (
                <div className="mt-4">
                  <SocialLinksDisplay links={socialLinks} />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ========================================
            Stats Row
            ======================================== */}
        <section className="mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-card border border-border text-center">
              <BookOpen className="h-5 w-5 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{stats.booksRead}</p>
              <p className="text-xs text-muted-foreground">Books Read</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border text-center">
              <BookMarked className="h-5 w-5 mx-auto mb-2 text-accent" />
              <p className="text-2xl font-bold">{stats.booksReading}</p>
              <p className="text-xs text-muted-foreground">Reading</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border text-center">
              <Library className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.booksWantToRead}</p>
              <p className="text-xs text-muted-foreground">Want to Read</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border text-center">
              <Star className="h-5 w-5 mx-auto mb-2 text-accent" />
              <p className="text-2xl font-bold">{stats.reviewsCount}</p>
              <p className="text-xs text-muted-foreground">Reviews</p>
            </div>
          </div>
        </section>

        {/* ========================================
            Bookshelves Section
            ======================================== */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold font-serif">Bookshelves</h2>
          </div>

          {/* Tab Buttons */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {[
              { key: "all", label: "All" },
              { key: "reading", label: "Reading" },
              { key: "read", label: "Read" },
              { key: "want", label: "Want to Read" },
            ].map(({ key, label }) => (
              <Link
                key={key}
                href={`/users/${username}${key === "all" ? "" : `?tab=${key}`}`}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                  activeTab === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Books Grid */}
          {books.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {books.map(
                (userBook) =>
                  userBook.book && (
                    <BookCard
                      key={userBook.id}
                      book={{
                        id: userBook.book.id,
                        title: userBook.book.title,
                        author: userBook.book.author,
                        slug: userBook.book.slug,
                        cover_url: userBook.book.cover_url,
                        average_rating: null,
                      }}
                      size="sm"
                      showRating={false}
                    />
                  )
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No books in this shelf yet.
            </p>
          )}
        </section>

        {/* ========================================
            Recent Reviews Section
            ======================================== */}
        {reviews.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold font-serif mb-4">
              Recent Reviews
            </h2>
            <div className="space-y-4">
              {reviews.map((review) => (
                <Link
                  key={review.id}
                  href={`/books/${review.book?.slug}`}
                  className="block p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex gap-4">
                    {/* Book Cover */}
                    <div className="flex-shrink-0 w-12 h-18 rounded overflow-hidden bg-muted">
                      {review.book?.cover_url ? (
                        <Image
                          src={review.book.cover_url}
                          alt={review.book.title}
                          width={48}
                          height={72}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Review Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <h3 className="font-medium truncate">
                            {review.book?.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {review.book?.author}
                          </p>
                        </div>
                        <RatingDisplay
                          rating={review.rating}
                          size="sm"
                          showCount={false}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {truncate(review.content, 150)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

