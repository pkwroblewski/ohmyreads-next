"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  BookOpen,
  Check,
  X,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  getPendingSubmissions,
  getAllSubmissions,
  moderateSubmission,
} from "@/lib/actions/book-submissions";
import type { BookSubmissionWithSubmitter } from "@/types/database";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<BookSubmissionWithSubmitter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [isPending, startTransition] = useTransition();

  // Rejection modal state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const loadSubmissions = async (status: StatusFilter) => {
    setIsLoading(true);
    try {
      if (status === "pending") {
        const result = await getPendingSubmissions();
        setSubmissions(result.submissions || []);
      } else {
        const result = await getAllSubmissions(
          status === "all" ? undefined : status
        );
        setSubmissions(result.submissions || []);
      }
    } catch (error) {
      console.error("Error loading submissions:", error);
      toast.error("Failed to load submissions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions(statusFilter);
  }, [statusFilter]);

  const handleApprove = async (submissionId: string) => {
    startTransition(async () => {
      try {
        const result = await moderateSubmission({
          submissionId,
          action: "approve",
        });

        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Book approved and added to catalog!");
          loadSubmissions(statusFilter);
        }
      } catch {
        toast.error("Failed to approve submission");
      }
    });
  };

  const handleReject = async (submissionId: string) => {
    startTransition(async () => {
      try {
        const result = await moderateSubmission({
          submissionId,
          action: "reject",
          rejectionReason: rejectionReason || undefined,
        });

        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Submission rejected");
          setRejectingId(null);
          setRejectionReason("");
          loadSubmissions(statusFilter);
        }
      } catch {
        toast.error("Failed to reject submission");
      }
    });
  };

  const statusCounts = {
    pending: submissions.filter((s) => s.status === "pending").length,
    approved: submissions.filter((s) => s.status === "approved").length,
    rejected: submissions.filter((s) => s.status === "rejected").length,
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-serif">Book Submissions</h1>
          <p className="text-muted-foreground">
            Review and moderate user-submitted books
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => loadSubmissions(statusFilter)}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(["pending", "approved", "rejected", "all"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
              statusFilter === status
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== "all" && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-background/20 text-xs">
                {statusCounts[status as keyof typeof statusCounts] || 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Submissions List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No submissions found</h2>
          <p className="text-muted-foreground">
            {statusFilter === "pending"
              ? "All caught up! No pending submissions to review."
              : `No ${statusFilter} submissions.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => {
            const submitter = submission.submitter;
            const isRejecting = rejectingId === submission.id;

            return (
              <div
                key={submission.id}
                className="p-6 rounded-xl border bg-card"
              >
                <div className="flex gap-6">
                  {/* Book Cover */}
                  <div className="w-24 h-36 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    {submission.cover_url ? (
                      <img
                        src={submission.cover_url}
                        alt={submission.title}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <BookOpen className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {submission.title}
                        </h3>
                        <p className="text-muted-foreground">
                          by {submission.author}
                        </p>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium",
                          submission.status === "pending" &&
                            "bg-amber-500/10 text-amber-600",
                          submission.status === "approved" &&
                            "bg-green-500/10 text-green-600",
                          submission.status === "rejected" &&
                            "bg-red-500/10 text-red-600"
                        )}
                      >
                        {submission.status}
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
                      {submission.isbn && <span>ISBN: {submission.isbn}</span>}
                      {submission.page_count && (
                        <span>{submission.page_count} pages</span>
                      )}
                      {submission.published_date && (
                        <span>Published: {submission.published_date}</span>
                      )}
                      {submission.genres && submission.genres.length > 0 && (
                        <span>{submission.genres.join(", ")}</span>
                      )}
                    </div>

                    {/* Description */}
                    {submission.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {submission.description}
                      </p>
                    )}

                    {/* Submitter info */}
                    <div className="flex items-center gap-2 text-sm mb-4">
                      <span className="text-muted-foreground">Submitted by</span>
                      {submitter && (
                        <Link
                          href={`/users/${submitter.username}`}
                          className="flex items-center gap-2 hover:text-primary"
                        >
                          <Avatar className="h-5 w-5">
                            {submitter.avatar_url && (
                              <AvatarImage src={submitter.avatar_url} />
                            )}
                            <AvatarFallback className="text-[10px]">
                              {(submitter.display_name || submitter.username)[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            {submitter.display_name || submitter.username}
                          </span>
                        </Link>
                      )}
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(new Date(submission.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>

                    {/* Actions for pending */}
                    {submission.status === "pending" && (
                      <>
                        {isRejecting ? (
                          <div className="space-y-3 p-4 bg-muted rounded-lg">
                            <p className="text-sm font-medium">
                              Rejection Reason (optional):
                            </p>
                            <Input
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              placeholder="e.g., Duplicate entry, Incomplete information..."
                              maxLength={500}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(submission.id)}
                                disabled={isPending}
                              >
                                {isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Confirm Rejection"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setRejectingId(null);
                                  setRejectionReason("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(submission.id)}
                              disabled={isPending}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Check className="h-4 w-4 mr-2" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRejectingId(submission.id)}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                            {submission.cover_url && (
                              <a
                                href={submission.cover_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-auto"
                              >
                                <Button size="sm" variant="ghost">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </a>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {/* Rejection reason for rejected */}
                    {submission.status === "rejected" &&
                      submission.rejection_reason && (
                        <div className="p-3 rounded bg-red-500/5 border border-red-500/20">
                          <p className="text-sm text-red-600">
                            <strong>Rejection reason:</strong>{" "}
                            {submission.rejection_reason}
                          </p>
                        </div>
                      )}

                    {/* Link for approved */}
                    {submission.status === "approved" && submission.book_id && (
                      <Link
                        href={`/books/${submission.slug}`}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        View in catalog
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

