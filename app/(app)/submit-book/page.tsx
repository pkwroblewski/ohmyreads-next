import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookSubmissionForm } from "@/components/books/book-submission-form";

export const metadata = {
  title: "Submit a Book",
  description: "Submit a book to be added to the OhMyReads catalog.",
};

export default async function SubmitBookPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/submit-book");
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <BookSubmissionForm />
    </div>
  );
}

