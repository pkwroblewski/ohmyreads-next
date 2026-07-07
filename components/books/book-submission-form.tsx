"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, BookPlus, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { submitBook } from "@/lib/actions/book-submissions";

const GENRE_OPTIONS = [
  "Fiction",
  "Non-Fiction",
  "Mystery",
  "Thriller",
  "Romance",
  "Science Fiction",
  "Fantasy",
  "Horror",
  "Biography",
  "History",
  "Self-Help",
  "Business",
  "Science",
  "Philosophy",
  "Poetry",
  "Classics",
  "Young Adult",
  "Children",
  "Graphic Novel",
  "Memoir",
];

export function BookSubmissionForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [publishedDate, setPublishedDate] = useState("");
  const [pageCount, setPageCount] = useState<string>("");

  const canSubmit = title.trim().length > 0 && author.trim().length > 0;

  const handleAddGenre = (genre: string) => {
    if (genres.length < 10 && !genres.includes(genre)) {
      setGenres([...genres, genre]);
    }
  };

  const handleRemoveGenre = (genre: string) => {
    setGenres(genres.filter((g) => g !== genre));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await submitBook({
        title: title.trim(),
        author: author.trim(),
        isbn: isbn.trim() || undefined,
        description: description.trim() || undefined,
        coverUrl: coverUrl.trim() || undefined,
        genres,
        publishedDate: publishedDate || undefined,
        pageCount: pageCount ? parseInt(pageCount, 10) : undefined,
      });

      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        toast.success(result.message || "Book submitted for review!");
        // Reset form
        setTitle("");
        setAuthor("");
        setIsbn("");
        setDescription("");
        setCoverUrl("");
        setGenres([]);
        setPublishedDate("");
        setPageCount("");
        // Land on My Submissions so the user sees their pending entry
        router.push("/my-submissions");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
      toast.error("Failed to submit book");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <BookPlus className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Submit a Book</h2>
          <p className="text-sm text-muted-foreground">
            Can&apos;t find a book? Submit it for our team to review.
          </p>
        </div>
      </div>

      {/* Required Fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium">
            Book Title <span className="text-destructive">*</span>
          </label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter the book title"
            maxLength={500}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="author" className="text-sm font-medium">
            Author <span className="text-destructive">*</span>
          </label>
          <Input
            id="author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Author name"
            maxLength={200}
            required
          />
        </div>
      </div>

      {/* Optional Fields */}
      <div className="space-y-4 pt-4 border-t">
        <p className="text-sm text-muted-foreground">Optional Information</p>

        <div className="space-y-2">
          <label htmlFor="isbn" className="text-sm font-medium">
            ISBN
          </label>
          <Input
            id="isbn"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            placeholder="978-0-123456-78-9"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the book..."
            className={cn(
              "w-full min-h-[100px] p-3 rounded-lg",
              "bg-background border border-input",
              "focus:outline-none focus:ring-2 focus:ring-ring",
              "placeholder:text-muted-foreground resize-y"
            )}
            maxLength={5000}
          />
          <p className="text-xs text-right text-muted-foreground">
            {description.length}/5000
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="coverUrl" className="text-sm font-medium">
            Cover Image URL
          </label>
          <Input
            id="coverUrl"
            type="url"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://example.com/book-cover.jpg"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="publishedDate" className="text-sm font-medium">
              Publication Date
            </label>
            <Input
              id="publishedDate"
              type="date"
              value={publishedDate}
              onChange={(e) => setPublishedDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="pageCount" className="text-sm font-medium">
              Page Count
            </label>
            <Input
              id="pageCount"
              type="number"
              min="1"
              max="50000"
              value={pageCount}
              onChange={(e) => setPageCount(e.target.value)}
              placeholder="e.g., 320"
            />
          </div>
        </div>

        {/* Genres */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Genres ({genres.length}/10)
          </label>

          {/* Selected genres */}
          {genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {genres.map((genre) => (
                <span
                  key={genre}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-sm"
                >
                  {genre}
                  <button
                    type="button"
                    onClick={() => handleRemoveGenre(genre)}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Genre options */}
          <div className="flex flex-wrap gap-2">
            {GENRE_OPTIONS.filter((g) => !genres.includes(g)).map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => handleAddGenre(genre)}
                disabled={genres.length >= 10}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm",
                  "border border-input hover:bg-muted transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <Plus className="h-3 w-3" />
                {genre}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <div className="flex gap-4 pt-4">
        <Button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="min-w-[160px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Book"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>

      {/* Info note */}
      <p className="text-xs text-muted-foreground">
        Submitted books will be reviewed by our team before being added to the
        catalog. This usually takes 1-2 business days.
      </p>
    </form>
  );
}

