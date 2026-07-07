"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, X, Hash, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CoverImage } from "@/components/books/cover-image";
import {
  approveBookSubmission,
  rejectBookSubmission,
} from "@/lib/actions/book-submissions";
import type { BookSubmissionWithSubmitter } from "@/types/database";

interface ModerationCardProps {
  submission: BookSubmissionWithSubmitter;
  onModerated?: (id: string, status: "approved" | "rejected") => void;
  readonly?: boolean;
}

export default function ModerationCard({
  submission,
  onModerated,
  readonly = false,
}: ModerationCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveBookSubmission(submission.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`"${submission.title}" approved and added to catalog!`);
        onModerated?.(submission.id, "approved");
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectBookSubmission(submission.id, rejectionReason);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Submission rejected");
        onModerated?.(submission.id, "rejected");
        setShowRejectForm(false);
      }
    });
  };

  const statusColors = {
    pending: "bg-yellow-500",
    approved: "bg-green-500",
    rejected: "bg-red-500",
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex gap-6">
          {/* Cover */}
          <div className="flex-shrink-0">
            <CoverImage
              book={{
                title: submission.title,
                author: submission.author,
                cover_url: submission.cover_url,
              }}
              width={100}
              height={150}
              hover={false}
            />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg">{submission.title}</h3>
                <p className="text-muted-foreground">by {submission.author}</p>
              </div>
              <Badge className={statusColors[submission.status ?? "pending"]}>
                {submission.status ?? "pending"}
              </Badge>
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {submission.isbn && (
                <span className="flex items-center gap-1">
                  <Hash className="h-4 w-4" />
                  {submission.isbn}
                </span>
              )}
              {submission.page_count && (
                <span>{submission.page_count} pages</span>
              )}
              {submission.published_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {submission.published_date}
                </span>
              )}
            </div>

            {/* Genres */}
            {(submission.genres?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1">
                {(submission.genres ?? []).map((genre) => (
                  <Badge key={genre} variant="secondary" className="text-xs">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            {/* Description */}
            {submission.description && (
              <p className="text-sm line-clamp-2">{submission.description}</p>
            )}

            {/* Submitter */}
            <div className="flex items-center gap-2 pt-2 border-t text-sm">
              <Avatar className="h-6 w-6">
                <AvatarImage
                  src={submission.submitter?.avatar_url || undefined}
                />
                <AvatarFallback>
                  {submission.submitter?.username?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground">
                Submitted by{" "}
                {submission.submitter?.display_name ||
                  submission.submitter?.username}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {formatDistanceToNow(new Date(submission.created_at ?? 0), {
                  addSuffix: true,
                })}
              </span>
            </div>

            {/* Rejection Reason */}
            {submission.status === "rejected" && submission.rejection_reason && (
              <div className="p-3 rounded-md bg-destructive/10 text-sm">
                <strong>Rejection reason:</strong> {submission.rejection_reason}
              </div>
            )}

            {/* Actions */}
            {!readonly && submission.status === "pending" && (
              <div className="pt-4">
                {showRejectForm ? (
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Reason for rejection (optional)..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleReject}
                        disabled={isPending}
                      >
                        Confirm Reject
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRejectForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleApprove}
                      disabled={isPending}
                      className="gap-2"
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectForm(true)}
                      disabled={isPending}
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

