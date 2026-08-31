import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Clock, ExternalLink } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { getAllSubmissions } from "@/lib/actions/book-submissions";
import { SubmissionModerationActions } from "@/components/admin/submission-moderation-actions";
import {
  toAdminParams,
  readEnum,
  buildAdminQuery,
  type RawSearchParams,
} from "@/lib/admin/search-params";

export const metadata: Metadata = {
  title: "Book Submissions | Admin",
  robots: { index: false, follow: false },
};

const PATHNAME = "/admin/submissions";
const STATUSES = ["pending", "approved", "rejected", "all"] as const;

interface PageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function AdminSubmissionsPage({ searchParams }: PageProps) {
  const params = toAdminParams(await searchParams);
  const status = readEnum(params, "status", STATUSES, "pending");

  // One unfiltered read serves both the list and the tab counts. The version
  // this replaces derived its counts from whichever filtered list was loaded,
  // so the "pending" badge read 0 whenever the admin was on any other tab.
  const result = await getAllSubmissions();
  const all = result.submissions ?? [];

  const submissions =
    status === "all" ? all : all.filter((s) => s.status === status);

  const statusCounts = {
    pending: all.filter((s) => s.status === "pending").length,
    approved: all.filter((s) => s.status === "approved").length,
    rejected: all.filter((s) => s.status === "rejected").length,
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
      </div>

      {/* Filter Tabs — real links, so each tab is a shareable URL */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`${PATHNAME}${buildAdminQuery(params, {
              status: s === "pending" ? undefined : s,
            })}`}
            scroll={false}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
              status === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-background/20 text-xs">
                {statusCounts[s]}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Submissions List */}
      {result.error ? (
        <div className="text-center py-16 bg-card rounded-xl border">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">
            Could not load submissions
          </h2>
          <p className="text-muted-foreground">{result.error}</p>
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No submissions found</h2>
          <p className="text-muted-foreground">
            {status === "pending"
              ? "All caught up! No pending submissions to review."
              : `No ${status} submissions.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => {
            const submitter = submission.submitter;

            return (
              <div key={submission.id} className="p-6 rounded-xl border bg-card">
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
                              {(submitter.display_name ||
                                submitter.username)[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            {submitter.display_name || submitter.username}
                          </span>
                        </Link>
                      )}
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(
                          new Date(submission.created_at ?? 0),
                          { addSuffix: true }
                        )}
                      </span>
                    </div>

                    {/* Actions for pending */}
                    {submission.status === "pending" && (
                      <SubmissionModerationActions
                        submissionId={submission.id}
                        title={submission.title}
                        coverUrl={submission.cover_url}
                      />
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
