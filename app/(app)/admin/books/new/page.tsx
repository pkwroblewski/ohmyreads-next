import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { BookForm } from "@/components/admin/book-form";
import { adminGetGenres } from "@/lib/actions/admin-books";

export const metadata: Metadata = {
  title: "Add New Book | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminNewBookPage() {
  const genresResult = await adminGetGenres();
  const genres = genresResult.success ? genresResult.genres || [] : [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-serif">Add New Book</h1>
          <p className="text-muted-foreground">
            Manually add a book to the catalog
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="p-6 rounded-xl bg-card border">
        <BookForm genres={genres} />
      </div>
    </div>
  );
}
