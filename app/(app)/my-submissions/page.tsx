import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { BookPlus, Clock, CheckCircle, XCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export const metadata = {
  title: "My Submissions",
  description: "View your book submissions and their status.",
};

export default async function MySubmissionsPage() {
  const {
    data: { user },
  } = await getUser();

  if (!user) {
    redirect("/login?redirect=/my-submissions");
  }

  // Fetch user's submissions
  const supabase = await createClient();
  const { data: submissions } = await supabase
    .from("book_submissions")
    .select("*")
    .eq("submitted_by", user.id)
    .order("created_at", { ascending: false });

  const statusConfig = {
    pending: {
      icon: Clock,
      label: "Pending Review",
      className: "text-amber-600 bg-amber-500/10",
    },
    approved: {
      icon: CheckCircle,
      label: "Approved",
      className: "text-green-600 bg-green-500/10",
    },
    rejected: {
      icon: XCircle,
      label: "Rejected",
      className: "text-red-600 bg-red-500/10",
    },
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-serif">My Submissions</h1>
          <p className="text-muted-foreground">
            Track the status of books you&apos;ve submitted
          </p>
        </div>
        <Link href="/submit-book">
          <Button>
            <BookPlus className="mr-2 h-4 w-4" />
            Submit a Book
          </Button>
        </Link>
      </div>

      {/* Submissions List */}
      {!submissions || submissions.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No submissions yet</h2>
          <p className="text-muted-foreground mb-6">
            Can&apos;t find a book in our catalog? Submit it for review!
          </p>
          <Link href="/submit-book">
            <Button>Submit Your First Book</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => {
            const status = statusConfig[submission.status as keyof typeof statusConfig];
            const StatusIcon = status.icon;

            return (
              <div
                key={submission.id}
                className="p-6 rounded-xl border bg-card hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Cover placeholder */}
                  <div className="w-16 h-24 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    {submission.cover_url ? (
                      <img
                        src={submission.cover_url}
                        alt={submission.title}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <BookOpen className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold truncate">
                          {submission.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          by {submission.author}
                        </p>
                      </div>

                      {/* Status badge */}
                      <div
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium whitespace-nowrap",
                          status.className
                        )}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {status.label}
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                      <span>
                        Submitted{" "}
                        {formatDistanceToNow(new Date(submission.created_at ?? 0), {
                          addSuffix: true,
                        })}
                      </span>
                      {submission.genres && submission.genres.length > 0 && (
                        <span>{submission.genres.slice(0, 2).join(", ")}</span>
                      )}
                    </div>

                    {/* Rejection reason */}
                    {submission.status === "rejected" &&
                      submission.rejection_reason && (
                        <div className="mt-3 p-3 rounded bg-red-500/5 border border-red-500/20">
                          <p className="text-sm text-red-600 dark:text-red-400">
                            <strong>Reason:</strong> {submission.rejection_reason}
                          </p>
                        </div>
                      )}

                    {/* Approved link */}
                    {submission.status === "approved" && submission.book_id && (
                      <div className="mt-3">
                        <Link
                          href={`/books/${submission.slug}`}
                          className="text-sm text-primary hover:underline"
                        >
                          View book in catalog →
                        </Link>
                      </div>
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

