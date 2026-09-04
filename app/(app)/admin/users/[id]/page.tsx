import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Users,
  ArrowLeft,
  BookOpen,
  MessageSquare,
  Calendar,
  Crown,
  Star,
  ExternalLink,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserDisableToggle } from "@/components/admin/user-disable-toggle";
import { adminGetUser } from "@/lib/queries/admin-users";
import { safeHref } from "@/lib/utils/sanitize";

export const metadata: Metadata = {
  title: "User Details | Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await adminGetUser(id);

  if (!result.success || !result.user) {
    notFound();
  }

  const user = result.user;
  const readingStats = Array.isArray(user.reading_stats)
    ? user.reading_stats[0]
    : user.reading_stats;
  const websiteHref = safeHref(user.website);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/users">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <UserDisableToggle
            userId={user.id}
            username={user.username}
            isDisabled={user.disabled_at !== null}
            isAdmin={user.is_admin ?? false}
          />
          <Link href={`/users/${user.username}`} target="_blank">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Profile
            </Button>
          </Link>
        </div>
      </div>

      {/* User Profile Card */}
      <div className="p-6 rounded-xl bg-card border">
        <div className="flex items-start gap-6">
          <Avatar className="h-24 w-24">
            <AvatarImage src={user.avatar_url || undefined} />
            <AvatarFallback className="text-2xl">
              {user.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">
                {user.display_name || user.username}
              </h1>
              {user.is_admin && (
                <Badge variant="secondary" className="gap-1">
                  <Crown className="h-3 w-3" />
                  Admin
                </Badge>
              )}
              {user.disabled_at && (
                <Badge variant="destructive" className="gap-1">
                  <Ban className="h-3 w-3" aria-hidden="true" />
                  Disabled {new Date(user.disabled_at).toLocaleDateString()}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mb-4">@{user.username}</p>

            {user.bio && (
              <p className="text-sm mb-4">{user.bio}</p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Joined {new Date(user.created_at).toLocaleDateString()}
              </div>
              {websiteHref && (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-primary"
                >
                  <ExternalLink className="h-4 w-4" />
                  {user.website}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <BookOpen className="h-4 w-4" />
            <span className="text-sm">Books on Shelf</span>
          </div>
          <p className="text-2xl font-bold">{user.books_count || 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <MessageSquare className="h-4 w-4" />
            <span className="text-sm">Reviews</span>
          </div>
          <p className="text-2xl font-bold">{user.reviews_count || 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-sm">Followers</span>
          </div>
          <p className="text-2xl font-bold">{user.followers_count || 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-sm">Following</span>
          </div>
          <p className="text-2xl font-bold">{user.following_count || 0}</p>
        </div>
      </div>

      {/* Reading Stats */}
      {readingStats && (
        <div className="p-6 rounded-xl bg-card border">
          <h2 className="text-lg font-semibold mb-4">Reading Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Books Read</p>
              <p className="text-xl font-bold">{readingStats.books_read || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pages Read</p>
              <p className="text-xl font-bold">
                {(readingStats.pages_read || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Streak</p>
              <p className="text-xl font-bold">
                {readingStats.current_streak || 0} days
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Review Count</p>
              <p className="text-xl font-bold">
                {readingStats.reviews_count || 0}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Books */}
        <div className="p-6 rounded-xl bg-card border">
          <h2 className="text-lg font-semibold mb-4">Recent Books</h2>
          {user.recent_books && user.recent_books.length > 0 ? (
            <div className="space-y-3">
              {user.recent_books.map((item: {
                id: string;
                status: string;
                created_at: string;
                book: { id: string; title: string; author: string; slug: string } | { id: string; title: string; author: string; slug: string }[];
              }) => {
                const book = Array.isArray(item.book) ? item.book[0] : item.book;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <Link
                        href={`/books/${book?.slug}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {book?.title || "Unknown"}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {book?.author}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {item.status.replace("_", " ")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No books yet</p>
          )}
        </div>

        {/* Recent Reviews */}
        <div className="p-6 rounded-xl bg-card border">
          <h2 className="text-lg font-semibold mb-4">Recent Reviews</h2>
          {user.recent_reviews && user.recent_reviews.length > 0 ? (
            <div className="space-y-3">
              {user.recent_reviews.map((review: {
                id: string;
                rating: number | null;
                summary: string | null;
                created_at: string;
                book: { id: string; title: string; slug: string } | { id: string; title: string; slug: string }[];
              }) => {
                const book = Array.isArray(review.book) ? review.book[0] : review.book;
                return (
                  <div
                    key={review.id}
                    className="py-2 border-b last:border-0"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Link
                        href={`/books/${book?.slug}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {book?.title || "Unknown"}
                      </Link>
                      <div className="flex items-center gap-1 text-accent">
                        {review.rating != null ? (
                          <>
                            <Star className="h-4 w-4 fill-current" />
                            <span>{review.rating}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-sm">&mdash;</span>
                        )}
                      </div>
                    </div>
                    {review.summary && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {review.summary}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No reviews yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
