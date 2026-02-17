import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { BookSubmissionForm } from "@/components/books/book-submission-form";

export const metadata: Metadata = {
  title: "Suggest a Book",
  description: "Submit a book to add to the OhMyReads catalog",
  robots: { index: false, follow: false },
};

export default async function NewBookPage() {
  const {
    data: { user },
  } = await getUser();

  if (!user) {
    redirect("/login?redirect=/books/new");
  }

  return (
    <div className="container max-w-4xl py-8">
      <BookSubmissionForm />
    </div>
  );
}

