import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { BookForm } from "@/components/admin/book-form";
import { adminGetBook, adminGetGenres } from "@/lib/actions/admin-books";

export const metadata: Metadata = {
  title: "Edit Book | Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditBookPage({ params }: PageProps) {
  const { id } = await params;

  const [bookResult, genresResult] = await Promise.all([
    adminGetBook(id),
    adminGetGenres(),
  ]);

  if (!bookResult.success || !bookResult.book) {
    notFound();
  }

  const genres = genresResult.success ? genresResult.genres || [] : [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-serif">Edit Book</h1>
          <p className="text-muted-foreground">
            {bookResult.book.title} by {bookResult.book.author}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="p-6 rounded-xl bg-card border">
        <BookForm book={bookResult.book} genres={genres} />
      </div>
    </div>
  );
}
