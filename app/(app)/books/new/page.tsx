import { redirect } from "next/navigation";

// Duplicate of /submit-book (both rendered the identical BookSubmissionForm).
// Route kept alive for old links; canonical page is /submit-book.
export default function NewBookPage() {
  redirect("/submit-book");
}
