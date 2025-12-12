import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getPendingSubmissions,
  getSubmissionHistory,
} from "@/lib/queries/book-submissions";
import ModerationDashboard from "@/components/admin/moderation-dashboard";

export const metadata: Metadata = {
  title: "Book Moderation | OhMyReads",
  description: "Review and moderate book submissions",
  robots: { index: false, follow: false },
};

export default async function BookModerationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/dashboard");
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

