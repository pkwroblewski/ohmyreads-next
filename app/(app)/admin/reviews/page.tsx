import type { Metadata } from "next";
import Link from "next/link";
import {
  MessageSquare,
  Star,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AdminSearchInput,
  AdminSelectFilter,
} from "@/components/admin/admin-filters";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { ReviewRowActions } from "@/components/admin/review-row-actions";
import {
  adminGetReviews,
  adminGetReviewStats,
  type ReviewFilters,
} from "@/lib/queries/admin-reviews";
import {
  toAdminParams,
  readPage,
  readEnum,
  type RawSearchParams,
} from "@/lib/admin/search-params";

export const metadata: Metadata = {
  title: "Manage Reviews | Admin",
  robots: { index: false, follow: false },
};

const PATHNAME = "/admin/reviews";
const LIMIT = 20;

const SORT_FIELDS = [
  "created_at",
  "rating",
  "likes_count",
] as const satisfies readonly NonNullable<ReviewFilters["sortBy"]>[];

const SORT_ORDERS = ["desc", "asc"] as const;
const RATINGS = ["all", "1", "2", "3", "4", "5"] as const;
const SPOILER_FILTERS = ["all", "true", "false"] as const;

const EMPTY_STATS = {
  total: 0,
  spoilers: 0,
  today: 0,
  ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>,
};

interface PageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function AdminReviewsPage({ searchParams }: PageProps) {
  const params = toAdminParams(await searchParams);

  const search = params.search ?? "";
  const rating = readEnum(params, "rating", RATINGS, "all");
  const isSpoiler = readEnum(params, "isSpoiler", SPOILER_FILTERS, "all");
  const sortBy = readEnum(params, "sortBy", SORT_FIELDS, "created_at");
  const sortOrder = readEnum(params, "sortOrder", SORT_ORDERS, "desc");
  const page = readPage(params);

  const [result, statsResult] = await Promise.all([
    adminGetReviews({
      search: search || undefined,
      rating: rating !== "all" ? Number.parseInt(rating, 10) : undefined,
      isSpoiler: isSpoiler === "all" ? undefined : isSpoiler === "true",
      sortBy,
      sortOrder,
      page,
      limit: LIMIT,
    }),
    adminGetReviewStats(),
  ]);

  const reviews = result.success ? result.reviews ?? [] : [];
  const total = result.success ? result.total ?? 0 : 0;
  const totalPages = result.success ? result.totalPages ?? 0 : 0;
  const stats = statsResult.success
    ? statsResult.stats ?? EMPTY_STATS
    : EMPTY_STATS;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-serif">Manage Reviews</h1>
            <p className="text-muted-foreground">
              {total.toLocaleString()} total reviews
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border">
          <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">Total Reviews</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <p className="text-2xl font-bold">{stats.today}</p>
          <p className="text-sm text-muted-foreground">Today</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <p className="text-2xl font-bold">{stats.spoilers}</p>
          <p className="text-sm text-muted-foreground">Spoiler Reviews</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-1">
            {[5, 4, 3, 2, 1].map((r) => (
              <div
                key={r}
                className="flex-1 h-6 bg-muted rounded-sm overflow-hidden"
                title={`${r} stars: ${stats.ratingDistribution[r] ?? 0}`}
              >
                <div
                  className="h-full bg-accent"
                  style={{
                    height: `${
                      stats.total > 0
                        ? ((stats.ratingDistribution[r] ?? 0) / stats.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Rating Distribution
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-card border">
        <div className="flex-1 min-w-[200px]">
          <AdminSearchInput
            pathname={PATHNAME}
            params={params}
            placeholder="Search reviews, books, or users..."
          />
        </div>

        <AdminSelectFilter
          pathname={PATHNAME}
          params={params}
          name="rating"
          value={rating}
          defaultValue="all"
          placeholder="Rating"
          className="w-[130px]"
          options={[
            { value: "all", label: "All Ratings" },
            { value: "5", label: "5 Stars" },
            { value: "4", label: "4 Stars" },
            { value: "3", label: "3 Stars" },
            { value: "2", label: "2 Stars" },
            { value: "1", label: "1 Star" },
          ]}
        />

        <AdminSelectFilter
          pathname={PATHNAME}
          params={params}
          name="isSpoiler"
          value={isSpoiler}
          defaultValue="all"
          placeholder="Spoilers"
          className="w-[140px]"
          options={[
            { value: "all", label: "All Reviews" },
            { value: "true", label: "Spoilers Only" },
            { value: "false", label: "No Spoilers" },
          ]}
        />

        <AdminSelectFilter
          pathname={PATHNAME}
          params={params}
          name="sortBy"
          value={sortBy}
          defaultValue="created_at"
          placeholder="Sort by"
          className="w-[130px]"
          options={[
            { value: "created_at", label: "Date" },
            { value: "rating", label: "Rating" },
            { value: "likes_count", label: "Likes" },
          ]}
        />

        <AdminSelectFilter
          pathname={PATHNAME}
          params={params}
          name="sortOrder"
          value={sortOrder}
          defaultValue="desc"
          className="w-[110px]"
          options={[
            { value: "desc", label: "Newest" },
            { value: "asc", label: "Oldest" },
          ]}
        />
      </div>

      {/* Reviews List */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {!result.success ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Could not load reviews</p>
            <p className="text-sm">{result.error || "Please try again."}</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No reviews found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="divide-y">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Book Cover */}
                  <Link href={`/books/${review.book.slug}`} className="shrink-0">
                    {review.book.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL host is not guaranteed to be in ALLOWED_IMAGE_HOSTS
                      <img
                        src={review.book.cover_url}
                        alt={`Cover of ${review.book.title}`}
                        className="w-12 h-18 rounded object-cover bg-muted"
                      />
                    ) : (
                      <div className="w-12 h-18 rounded bg-muted flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </Link>

                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <Link
                          href={`/books/${review.book.slug}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {review.book.title}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          by {review.book.author}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-accent">
                          {review.rating != null ? (
                            <>
                              <Star className="h-4 w-4 fill-current" />
                              <span className="font-medium">{review.rating}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              &mdash;
                            </span>
                          )}
                        </div>
                        {review.is_spoiler && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Spoiler
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Content Preview */}
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {review.summary || review.content || "No text content"}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/users/${review.user.username}`}
                          className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage
                              src={review.user.avatar_url || undefined}
                            />
                            <AvatarFallback className="text-xs">
                              {review.user.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {review.user.display_name || review.user.username}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <ReviewRowActions review={review} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <AdminPagination
          pathname={PATHNAME}
          params={params}
          page={page}
          totalPages={totalPages}
          total={total}
          label="reviews"
        />
      </div>
    </div>
  );
}
