import { Metadata } from "next";
import { redirect } from "next/navigation";
import { checkAdmin } from "@/lib/auth/require-admin";
import {
  getPendingSubmissions,
  getSubmissionHistory,
} from "@/lib/queries/book-submissions";
import ModerationDashboard from "@/components/admin/moderation-dashboard";

export const metadata: Metadata = {
  title: "Book Moderation",
  description: "Review and moderate book submissions",
  robots: { index: false, follow: false },
};

export default async function BookModerationPage() {
  const admin = await checkAdmin();

  if (!admin.ok) {
    redirect(admin.reason === "unauthenticated" ? "/login" : "/dashboard");
  }

  const [pending, history] = await Promise.all([
    getPendingSubmissions(50),
    getSubmissionHistory(20),
  ]);

  return (
    <div className="container max-w-6xl py-8">
      <ModerationDashboard
        pendingSubmissions={pending}
        submissionHistory={history}
      />
    </div>
  );
}

