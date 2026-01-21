import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import {
  BookOpen,
  BookMarked,
  Library,
  Star,
  Globe,
  Calendar,
  Settings,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getUserStats,
  getUserBooks,
  getUserReviews,
  getSocialLinks,
} from "@/lib/queries/users";
import { getUserBadgesWithDefinitions } from "@/lib/queries/badges";
import { getFollowCounts } from "@/lib/queries/follows";
import { SocialLinksDisplay } from "@/components/social/social-links-display";
import FollowStats from "@/components/social/follow-stats";
import BadgesSection from "@/components/badges/badges-section";
import { BookCard } from "@/components/books/book-card";
import { RatingDisplay } from "@/components/ui/rating-display";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { truncate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My Profile",
};

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // Fetch data in parallel
  const [stats, booksResult, reviews, socialLinks, badges, followCounts] = await Promise.all([
    getUserStats(profile.id),
    getUserBooks(profile.id, { limit: 12 }),
    getUserReviews(profile.id, 5),
    getSocialLinks(profile.id),
    getUserBadgesWithDefinitions(profile.id),
    getFollowCounts(profile.id),
  ]);

  const books = booksResult.userBooks;

  const displayName = profile.display_name || profile.username;
  const memberSince = format(new Date(profile.created_at), "MMMM yyyy");

  return (
    <div className="max-w-4xl mx-auto">
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
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold font-serif">
                {displayName}
              </h1>
              <Link href="/profile/edit">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              </Link>
            </div>
            <p className="text-muted-foreground mb-2">@{profile.username}</p>
            <FollowStats
              username={profile.username}
              followersCount={followCounts.followers}
              followingCount={followCounts.following}
              className="mb-3 justify-center sm:justify-start"
            />

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
          Achievements Section
          ======================================== */}
      <BadgesSection
        badges={badges}
        userId={profile.id}
        isOwnProfile={true}
        variant="compact"
      />

      {/* ========================================
          My Books Section
          ======================================== */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold font-serif">My Books</h2>
          <Link
            href="/my-shelf"
            className="text-sm text-primary hover:underline"
          >
            View all →
          </Link>
        </div>

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
                      google_books_id: userBook.book.google_books_id,
                      isbn: userBook.book.isbn,
                      average_rating: null,
                    }}
                    size="sm"
                    showRating={false}
                  />
                )
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              You haven&apos;t added any books yet.
            </p>
            <Link href="/books">
              <Button>Browse Books</Button>
            </Link>
          </div>
        )}
      </section>

      {/* ========================================
          My Reviews Section
          ======================================== */}
      {reviews.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold font-serif mb-4">My Reviews</h2>
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
  );
}
