"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BarChart3,
  Users,
  BookOpen,
  MessageSquare,
  MapPin,
  TrendingUp,
  TrendingDown,
  Star,
  Loader2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  adminGetOverviewStats,
  adminGetGrowthData,
  adminGetTopBooks,
  adminGetTopUsers,
  adminGetGenreDistribution,
  adminGetRatingDistribution,
  type OverviewStats,
  type GrowthData,
  type TopBook,
  type TopUser,
  type GenreDistribution,
  type RatingDistribution,
} from "@/lib/queries/admin-analytics";

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [growthData, setGrowthData] = useState<GrowthData[]>([]);
  const [topBooks, setTopBooks] = useState<TopBook[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [genres, setGenres] = useState<GenreDistribution[]>([]);
  const [ratings, setRatings] = useState<RatingDistribution[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [statsResult, growthResult, booksResult, usersResult, genresResult, ratingsResult] =
      await Promise.all([
        adminGetOverviewStats(),
        adminGetGrowthData(),
        adminGetTopBooks(10),
        adminGetTopUsers(10),
        adminGetGenreDistribution(),
        adminGetRatingDistribution(),
      ]);

    if (statsResult.success) setStats(statsResult.stats || null);
    if (growthResult.success) setGrowthData(growthResult.data || []);
    if (booksResult.success) setTopBooks(booksResult.books || []);
    if (usersResult.success) setTopUsers(usersResult.users || []);
    if (genresResult.success) setGenres(genresResult.genres || []);
    if (ratingsResult.success) setRatings(ratingsResult.ratings || []);

    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void fetchData());
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const userGrowth = stats
    ? stats.users.lastMonth > 0
      ? Math.round(((stats.users.thisMonth - stats.users.lastMonth) / stats.users.lastMonth) * 100)
      : stats.users.thisMonth > 0
      ? 100
      : 0
    : 0;

  const maxGenreCount = genres.length > 0 ? Math.max(...genres.map((g) => g.count)) : 1;
  const maxRatingCount = ratings.length > 0 ? Math.max(...ratings.map((r) => r.count)) : 1;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <BarChart3 className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-serif">Analytics</h1>
          <p className="text-muted-foreground">
            Site metrics and engagement overview
          </p>
        </div>
      </div>

      {/* Overview Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-card border">
            <div className="flex items-center justify-between mb-3">
              <Users className="h-6 w-6 text-primary" />
              {userGrowth !== 0 && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    userGrowth > 0
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  }`}
                >
                  {userGrowth > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(userGrowth)}%
                </span>
              )}
            </div>
            <p className="text-2xl font-bold">{stats.users.total.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Users</p>
            <p className="text-xs text-muted-foreground mt-1">
              +{stats.users.thisMonth} this month
            </p>
          </div>

          <div className="p-5 rounded-xl bg-card border">
            <div className="flex items-center justify-between mb-3">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <p className="text-2xl font-bold">{stats.books.total.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Books</p>
            <p className="text-xs text-muted-foreground mt-1">
              +{stats.books.thisMonth} this month
            </p>
          </div>

          <div className="p-5 rounded-xl bg-card border">
            <div className="flex items-center justify-between mb-3">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <p className="text-2xl font-bold">{stats.reviews.total.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Reviews</p>
            <p className="text-xs text-muted-foreground mt-1">
              Avg rating: {stats.reviews.avgRating.toFixed(1)} ★
            </p>
          </div>

          <div className="p-5 rounded-xl bg-card border">
            <div className="flex items-center justify-between mb-3">
              <MapPin className="h-6 w-6 text-primary" />
              {stats.places.pending > 0 && (
                <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
                  {stats.places.pending} pending
                </Badge>
              )}
            </div>
            <p className="text-2xl font-bold">{stats.places.approved.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Approved Places</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.places.total} total
            </p>
          </div>
        </div>
      )}

      {/* Activity Chart (Simple Bar Representation) */}
      {growthData.length > 0 && (
        <div className="p-6 rounded-xl bg-card border">
          <h2 className="text-lg font-semibold mb-4">Daily Activity (Last 30 Days)</h2>
          <div className="flex items-end gap-1 h-32">
            {growthData.map((day) => {
              const total = day.users + day.reviews;
              const maxTotal = Math.max(...growthData.map((d) => d.users + d.reviews));
              const height = maxTotal > 0 ? (total / maxTotal) * 100 : 0;

              return (
                <div
                  key={day.date}
                  className="flex-1 bg-primary/20 rounded-t hover:bg-primary/40 transition-colors relative group"
                  style={{ height: `${Math.max(height, 2)}%` }}
                  title={`${day.date}: ${day.users} users, ${day.reviews} reviews`}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <p className="font-medium">{day.date}</p>
                    <p>{day.users} new users</p>
                    <p>{day.reviews} reviews</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>{growthData[0]?.date}</span>
            <span>{growthData[growthData.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Books */}
        <div className="p-6 rounded-xl bg-card border">
          <h2 className="text-lg font-semibold mb-4">Most Reviewed Books</h2>
          {topBooks.length > 0 ? (
            <div className="space-y-3">
              {topBooks.slice(0, 5).map((book, i) => (
                <Link
                  key={book.id}
                  href={`/books/${book.slug}`}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <span className="w-6 text-center text-muted-foreground font-medium">
                    {i + 1}
                  </span>
                  {book.cover_url ? (
                    <img
                      src={book.cover_url}
                      alt={`Cover of ${book.title}`}
                      className="w-8 h-12 rounded object-cover bg-muted"
                    />
                  ) : (
                    <div className="w-8 h-12 rounded bg-muted flex items-center justify-center">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{book.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {book.author}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{book.reviews_count}</p>
                    <p className="text-xs text-muted-foreground">reviews</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No data yet</p>
          )}
        </div>

        {/* Top Users */}
        <div className="p-6 rounded-xl bg-card border">
          <h2 className="text-lg font-semibold mb-4">Most Active Users</h2>
          {topUsers.length > 0 ? (
            <div className="space-y-3">
              {topUsers.slice(0, 5).map((user, i) => (
                <Link
                  key={user.id}
                  href={`/users/${user.username}`}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <span className="w-6 text-center text-muted-foreground font-medium">
                    {i + 1}
                  </span>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback>
                      {user.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {user.display_name || user.username}
                    </p>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p>{user.reviews_count} reviews</p>
                    <p className="text-muted-foreground">{user.books_count} books</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No data yet</p>
          )}
        </div>

        {/* Genre Distribution */}
        <div className="p-6 rounded-xl bg-card border">
          <h2 className="text-lg font-semibold mb-4">Genre Distribution</h2>
          {genres.length > 0 ? (
            <div className="space-y-2">
              {genres.slice(0, 8).map((genre) => (
                <div key={genre.genre} className="flex items-center gap-3">
                  <span className="w-24 text-sm truncate">{genre.genre}</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60"
                      style={{ width: `${(genre.count / maxGenreCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-sm text-muted-foreground text-right">
                    {genre.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No data yet</p>
          )}
        </div>

        {/* Rating Distribution */}
        <div className="p-6 rounded-xl bg-card border">
          <h2 className="text-lg font-semibold mb-4">Rating Distribution</h2>
          {ratings.length > 0 ? (
            <div className="space-y-2">
              {ratings.map((r) => (
                <div key={r.rating} className="flex items-center gap-3">
                  <span className="w-16 flex items-center gap-1">
                    <Star className="h-4 w-4 fill-accent text-accent" />
                    {r.rating}
                  </span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent/60"
                      style={{ width: `${(r.count / maxRatingCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 text-sm text-muted-foreground text-right">
                    {r.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
