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
  Lock,
} from "lucide-react";
import { getUser } from "@/lib/supabase/server";
import {
  getProfileByUsername,
  getUserStats,
  getUserReviews,
  getSocialLinks,
} from "@/lib/queries/users";
import { getUserBadgesWithDefinitions } from "@/lib/queries/badges";
import { getProfileShelf } from "@/lib/queries/shelf";
import { isFollowing, getFollowCounts } from "@/lib/queries/follows";
import { safeHref } from "@/lib/utils/sanitize";
import { getFriendshipStatus } from "@/lib/queries/friends";
import { SocialLinksDisplay } from "@/components/social/social-links-display";
import FollowButton from "@/components/social/follow-button";
import FriendButton from "@/components/social/friend-button";
import FollowStats from "@/components/social/follow-stats";
import BadgesSection from "@/components/badges/badges-section";
import { ProfileShelves } from "@/components/shelf/profile-shelves";
import { RatingDisplay } from "@/components/ui/rating-display";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { truncate } from "@/lib/utils";
import { safeJsonLd } from "@/lib/utils/jsonld";

interface Props {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ year?: string }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ username }, { year: yearParam }] = await Promise.all([params, searchParams]);
  const profile = await getProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  const name = profile.display_name || profile.username;
  // A shared year link (`ShareShelf`) unfurls as that year's shelf image;
  // the image route itself 404s for hidden readers and empty years.
  const year = Number(yearParam);
  const shareYear =
    profile.discovery_visible !== false && Number.isInteger(year) && year >= 1900 && year <= new Date().getFullYear() + 1
      ? year
      : null;

  return {
    title: `${name} (@${profile.username})`,
    description: profile.bio || `See what ${name} is reading on OhMyReads`,
    alternates: { canonical: `/users/${profile.username}` },
    // A reader who opted out of discovery should not be in search results
    // either; the page stays reachable by direct link.
    ...(profile.discovery_visible === false
      ? { robots: { index: false, follow: false } }
      : {}),
    openGraph: shareYear
      ? {
          title: `${name}'s ${shareYear} shelf`,
          description: `Every book ${name} read in ${shareYear}, on OhMyReads`,
          images: [
            {
              url: `/api/og/shelf?user=${encodeURIComponent(profile.username)}&year=${shareYear}`,
              width: 1200,
              height: 630,
              alt: `${name}'s ${shareYear} shelf`,
            },
          ],
        }
      : {
          title: `${name} on OhMyReads`,
          description: profile.bio || `Check out ${name}'s reading list`,
          images: profile.avatar_url ? [profile.avatar_url] : [],
        },
    ...(shareYear ? { twitter: { card: "summary_large_image" } } : {}),
  };
}

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params;

  // The viewer and the profile do not depend on each other: resolve both at once.
  const [
    {
      data: { user: currentUser },
    },
    profile,
  ] = await Promise.all([getUser(), getProfileByUsername(username)]);

  if (!profile) {
    notFound();
  }

  // Check if viewing own profile
  const isOwnProfile = currentUser?.id === profile.id;

  // Fetch data in parallel
  const [stats, shelf, reviews, socialLinks, badges, followCounts, isFollowingUser, friendshipData] = await Promise.all([
    getUserStats(profile.id),
    getProfileShelf(profile.id),
    getUserReviews(profile.id, 5),
    getSocialLinks(profile.id),
    getUserBadgesWithDefinitions(profile.id),
    getFollowCounts(profile.id),
    currentUser && !isOwnProfile ? isFollowing(currentUser.id, profile.id) : Promise.resolve(false),
    currentUser && !isOwnProfile ? getFriendshipStatus(profile.id) : Promise.resolve({ status: "none" as const, requestId: null }),
  ]);

  // Migration 056 gates user_books / reading_stats reads on discovery_visible,
  // so for an opted-out reader these come back empty rather than zero-by-fact.
  // Say so instead of rendering a misleading "0 books read".
  const shelfHidden = !isOwnProfile && profile.discovery_visible === false;

  const displayName = profile.display_name || profile.username;
  const memberSince = format(new Date(profile.created_at), "MMMM yyyy");
  const websiteHref = safeHref(profile.website);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ohmyreads.com";

  return (
    <>
      {/* JSON-LD for SEO — not for readers who opted out of discovery */}
      {profile.discovery_visible !== false && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd({
              "@context": "https://schema.org",
              "@type": "Person",
              name: displayName,
              url: `${siteUrl}/users/${profile.username}`,
              image: profile.avatar_url,
              description: profile.bio,
            }),
          }}
        />
      )}

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
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold font-serif mb-1">
                    {displayName}
                  </h1>
                  <p className="text-muted-foreground">@{profile.username}</p>
                </div>
                {currentUser && !isOwnProfile && (
                  <div className="flex gap-2">
                    <FriendButton
                      targetUserId={profile.id}
                      initialStatus={friendshipData.status}
                      requestId={friendshipData.requestId}
                      size="sm"
                    />
                    <FollowButton
                      targetUserId={profile.id}
                      initialIsFollowing={isFollowingUser}
                      size="sm"
                    />
                  </div>
                )}
              </div>

              {currentUser && !isOwnProfile && (
                <p className="text-xs text-muted-foreground mb-3">
                  Follow to see their activity in your feed &middot; Friends
                  can message each other
                </p>
              )}

              {/* Follow Stats */}
              <FollowStats
                username={profile.username}
                followersCount={followCounts.followers}
                followingCount={followCounts.following}
                className="mb-4"
              />

              {profile.bio && (
                <p className="text-muted-foreground mb-4 max-w-xl">
                  {profile.bio}
                </p>
              )}

              {/* Links & Meta */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-muted-foreground">
                {websiteHref && (
                  <a
                    href={websiteHref}
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
          {shelfHidden ? (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-3 p-4 rounded-xl bg-card border border-border text-center flex flex-col items-center justify-center">
                <Lock className="h-5 w-5 mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Shelves are private</p>
                <p className="text-xs text-muted-foreground">
                  {displayName} has opted out of reader discovery.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border text-center">
                <Star className="h-5 w-5 mx-auto mb-2 text-star" />
                <p className="text-2xl font-bold">{stats.reviewsCount}</p>
                <p className="text-xs text-muted-foreground">Reviews</p>
              </div>
            </div>
          ) : (
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
                <Star className="h-5 w-5 mx-auto mb-2 text-star" />
                <p className="text-2xl font-bold">{stats.reviewsCount}</p>
                <p className="text-xs text-muted-foreground">Reviews</p>
              </div>
            </div>
          )}
        </section>

        {/* ========================================
            Achievements Section
            ======================================== */}
        <BadgesSection
          badges={badges}
          userId={profile.id}
          isOwnProfile={false}
          variant="compact"
        />

        {/* ========================================
            Bookshelves Section
            ======================================== */}
        {!shelfHidden && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold font-serif">Shelves</h2>
          </div>

          <ProfileShelves
            shelf={shelf}
            isOwnProfile={isOwnProfile}
            shareAs={isOwnProfile && profile.discovery_visible !== false ? profile.username : undefined}
          />
        </section>
        )}

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

