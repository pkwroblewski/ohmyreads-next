import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MapPin, CheckCircle, ExternalLink, Clock } from "lucide-react";
import { checkAdmin } from "@/lib/auth/require-admin";
import { getPendingPlaceSubmissions } from "@/lib/actions/places";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlaceModerationActions } from "@/components/admin/place-moderation-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Place Moderation | Admin",
  description: "Review and moderate user-submitted places",
  robots: { index: false, follow: false },
};

export default async function PlaceModerationPage() {
  const admin = await checkAdmin();

  if (!admin.ok) {
    redirect(admin.reason === "unauthenticated" ? "/login?redirect=/admin/moderation/places" : "/dashboard");
  }

  const { submissions } = await getPendingPlaceSubmissions();

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10">
          <MapPin className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Place Moderation</h1>
          <p className="text-muted-foreground">
            Review user-submitted places for the community map
          </p>
        </div>
      </div>

      {/* Submissions List */}
      {submissions.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={CheckCircle}
              title="All caught up!"
              description="There are no pending place submissions to review."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {submissions.length} pending submission{submissions.length !== 1 ? "s" : ""}
          </p>

          {submissions.map((submission) => (
            <Card key={submission.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{submission.name}</CardTitle>
                    <CardDescription className="capitalize">
                      {submission.place_type.replace(/_/g, " ")}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDate(submission.created_at ?? "")}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Location Info */}
                <div className="grid gap-2 text-sm">
                  {submission.address && (
                    <p>
                      <span className="text-muted-foreground">Address:</span>{" "}
                      {submission.address}
                    </p>
                  )}
                  {(submission.city || submission.country) && (
                    <p>
                      <span className="text-muted-foreground">Location:</span>{" "}
                      {[submission.city, submission.country].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {submission.lat && submission.lng && (
                    <p>
                      <span className="text-muted-foreground">Coordinates:</span>{" "}
                      {submission.lat.toFixed(4)}, {submission.lng.toFixed(4)}
                      <a
                        href={`https://www.google.com/maps?q=${submission.lat},${submission.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-primary hover:underline inline-flex items-center gap-1"
                      >
                        View on map <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  )}
                  {submission.website && (
                    <p>
                      <span className="text-muted-foreground">Website:</span>{" "}
                      <a
                        href={submission.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {submission.website} <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  )}
                </div>

                {/* Description */}
                {submission.description && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm">{submission.description}</p>
                  </div>
                )}

                {/* Submitter */}
                <p className="text-xs text-muted-foreground">
                  Submitted by:{" "}
                  {submission.submitter?.display_name ||
                    submission.submitter?.username ||
                    "Unknown user"}
                </p>

                {/* Actions */}
                <PlaceModerationActions submissionId={submission.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

