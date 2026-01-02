"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Star,
  Eye,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  adminGetReviews,
  adminDeleteReview,
  adminGetReviewStats,
  type ReviewFilters,
  type ReviewWithDetails,
} from "@/lib/actions/admin-reviews";

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewWithDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    total: number;
    spoilers: number;
    today: number;
    ratingDistribution: Record<number, number>;
  }>({
    total: 0,
    spoilers: 0,
    today: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });

  // Filters
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState<string>("all");
  const [isSpoiler, setIsSpoiler] = useState<string>("all");
  const [sortBy, setSortBy] = useState<ReviewFilters["sortBy"]>("created_at");
  const [sortOrder, setSortOrder] = useState<ReviewFilters["sortOrder"]>("desc");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<ReviewWithDetails | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  // View review dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [reviewToView, setReviewToView] = useState<ReviewWithDetails | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    const result = await adminGetReviews({
      search: search || undefined,
      rating: rating !== "all" ? parseInt(rating) : undefined,
      isSpoiler: isSpoiler === "all" ? undefined : isSpoiler === "true",
      sortBy,
      sortOrder,
      page,
      limit,
    });

    if (result.success) {
      setReviews(result.reviews || []);
      setTotal(result.total || 0);
      setTotalPages(result.totalPages || 0);
    }
    setLoading(false);
  }, [search, rating, isSpoiler, sortBy, sortOrder, page]);

  const fetchStats = useCallback(async () => {
    const result = await adminGetReviewStats();
    if (result.success && result.stats) {
      setStats(result.stats);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchReviews();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchReviews]);

  const handleDelete = async () => {
    if (!reviewToDelete) return;

    setDeleting(true);
    const result = await adminDeleteReview(reviewToDelete.id, deleteReason);
    setDeleting(false);

    if (result.success) {
      setDeleteDialogOpen(false);
      setReviewToDelete(null);
      setDeleteReason("");
      fetchReviews();
      fetchStats();
    }
  };

  const openDeleteDialog = (review: ReviewWithDetails) => {
    setReviewToDelete(review);
    setDeleteDialogOpen(true);
  };

  const openViewDialog = (review: ReviewWithDetails) => {
    setReviewToView(review);
    setViewDialogOpen(true);
  };

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
                title={`${r} stars: ${stats.ratingDistribution[r as keyof typeof stats.ratingDistribution]}`}
              >
                <div
                  className="h-full bg-accent"
                  style={{
                    height: `${
                      stats.total > 0
                        ? (stats.ratingDistribution[r as keyof typeof stats.ratingDistribution] / stats.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Rating Distribution</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-card border">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reviews, books, or users..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        </div>

        <Select
          value={rating}
          onValueChange={(v) => {
            setRating(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            <SelectItem value="5">5 Stars</SelectItem>
            <SelectItem value="4">4 Stars</SelectItem>
            <SelectItem value="3">3 Stars</SelectItem>
            <SelectItem value="2">2 Stars</SelectItem>
            <SelectItem value="1">1 Star</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={isSpoiler}
          onValueChange={(v) => {
            setIsSpoiler(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Spoilers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reviews</SelectItem>
            <SelectItem value="true">Spoilers Only</SelectItem>
            <SelectItem value="false">No Spoilers</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sortBy}
          onValueChange={(v) => setSortBy(v as ReviewFilters["sortBy"])}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Date</SelectItem>
            <SelectItem value="rating">Rating</SelectItem>
            <SelectItem value="likes_count">Likes</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sortOrder}
          onValueChange={(v) => setSortOrder(v as ReviewFilters["sortOrder"])}
        >
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest</SelectItem>
            <SelectItem value="asc">Oldest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reviews List */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
                      <img
                        src={review.book.cover_url}
                        alt=""
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
                          <Star className="h-4 w-4 fill-current" />
                          <span className="font-medium">{review.rating}</span>
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
                      {review.summary || review.content.slice(0, 150)}...
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/u/${review.user.username}`}
                          className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={review.user.avatar_url || undefined} />
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

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openViewDialog(review)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(review)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({total} reviews)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* View Review Dialog */}
      <AlertDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Review Details</AlertDialogTitle>
          </AlertDialogHeader>
          {reviewToView && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-accent">
                  <Star className="h-5 w-5 fill-current" />
                  <span className="font-bold text-lg">{reviewToView.rating}</span>
                </div>
                {reviewToView.is_spoiler && (
                  <Badge variant="destructive">Contains Spoilers</Badge>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Book</p>
                <p className="font-medium">{reviewToView.book.title}</p>
                <p className="text-sm text-muted-foreground">
                  by {reviewToView.book.author}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Reviewer</p>
                <p className="font-medium">
                  {reviewToView.user.display_name || reviewToView.user.username}
                </p>
              </div>
              {reviewToView.summary && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Summary</p>
                  <p>{reviewToView.summary}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Full Review</p>
                <div className="max-h-60 overflow-y-auto p-3 rounded-lg bg-muted/50">
                  <p className="whitespace-pre-wrap">{reviewToView.content}</p>
                </div>
              </div>
              {reviewToView.vibe_tags.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Vibe Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {reviewToView.vibe_tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setViewDialogOpen(false);
                if (reviewToView) openDeleteDialog(reviewToView);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Review
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this review by{" "}
              <strong>{reviewToDelete?.user.username}</strong> for{" "}
              <strong>{reviewToDelete?.book.title}</strong>? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">
              Reason for deletion (optional)
            </label>
            <Textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="e.g., Spam, inappropriate content, harassment..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Review"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
