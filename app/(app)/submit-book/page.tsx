import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { getUser } from "@/lib/supabase/server";
import { BookSubmissionForm } from "@/components/books/book-submission-form";

export const metadata = {
  title: "Submit a Book",
  description: "Submit a book to be added to the OhMyReads catalog.",
};

export default async function SubmitBookPage() {
  const {
    data: { user },
  } = await getUser();

  if (!user) {
    redirect("/login?redirect=/submit-book");
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-end mb-2">
        <Link
          href="/my-submissions"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ClipboardList className="h-4 w-4" />
          My Submissions
        </Link>
      </div>
      <BookSubmissionForm />
    </div>
  );
}

