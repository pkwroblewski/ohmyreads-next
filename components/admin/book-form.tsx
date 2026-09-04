"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Plus, Save, ArrowLeft } from "lucide-react";
import { adminCreateBook, adminUpdateBook, type AdminBookInput } from "@/lib/actions/admin-books";
import { Book } from "@/types/database";
import Link from "next/link";

interface BookFormProps {
  book?: Book;
  genres?: string[];
}

export function BookForm({ book, genres = [] }: BookFormProps) {
  const router = useRouter();
  const isEditing = !!book;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState(book?.title || "");
  const [author, setAuthor] = useState(book?.author || "");
  const [description, setDescription] = useState(book?.description || "");
  const [isbn, setIsbn] = useState(book?.isbn || "");
  const [isbn13, setIsbn13] = useState("");
  const [coverUrl, setCoverUrl] = useState(book?.cover_url || "");
  const [pageCount, setPageCount] = useState<string>(book?.page_count?.toString() || "");
  const [publishedDate, setPublishedDate] = useState(book?.published_date || "");
  const [selectedGenres, setSelectedGenres] = useState<string[]>(book?.genres || []);
  const [newGenre, setNewGenre] = useState("");

  const handleAddGenre = () => {
    const genre = newGenre.trim();
    if (genre && !selectedGenres.includes(genre)) {
      setSelectedGenres([...selectedGenres, genre]);
      setNewGenre("");
    }
  };

  const handleRemoveGenre = (genre: string) => {
    setSelectedGenres(selectedGenres.filter((g) => g !== genre));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const input: AdminBookInput = {
      title,
      author,
      description: description || undefined,
      isbn: isbn || undefined,
      isbn13: isbn13 || undefined,
      cover_url: coverUrl || undefined,
      page_count: pageCount ? parseInt(pageCount, 10) : undefined,
      published_date: publishedDate || undefined,
      genres: selectedGenres,
    };

    try {
      const result = isEditing
        ? await adminUpdateBook(book.id, input)
        : await adminCreateBook(input);

      if (result.success) {
        router.push("/admin/books");
        router.refresh();
      } else {
        setError(result.error || "An error occurred");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Basic Information</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Book title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="author">Author *</Label>
            <Input
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author name"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Book description or synopsis"
            rows={4}
          />
        </div>
      </div>

      {/* Publishing Info */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Publishing Details</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="isbn">ISBN-10</Label>
            <Input
              id="isbn"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="0123456789"
              maxLength={10}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="isbn13">ISBN-13</Label>
            <Input
              id="isbn13"
              value={isbn13}
              onChange={(e) => setIsbn13(e.target.value)}
              placeholder="978-0123456789"
              maxLength={17}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pageCount">Page Count</Label>
            <Input
              id="pageCount"
              type="number"
              value={pageCount}
              onChange={(e) => setPageCount(e.target.value)}
              placeholder="300"
              min={1}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="publishedDate">Published Date</Label>
            <Input
              id="publishedDate"
              type="date"
              value={publishedDate}
              onChange={(e) => setPublishedDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverUrl">Cover Image URL</Label>
            <Input
              id="coverUrl"
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        {/* Cover Preview */}
        {coverUrl && (
          <div className="flex items-start gap-4">
            <div className="w-24 h-36 rounded-md overflow-hidden bg-muted border">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL host is not guaranteed to be in ALLOWED_IMAGE_HOSTS */}
              <img
                src={coverUrl}
                alt="Cover preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <p className="text-sm text-muted-foreground">Cover preview</p>
          </div>
        )}
      </div>

      {/* Genres */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Genres</h2>

        <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-lg border bg-muted/30">
          {selectedGenres.length === 0 ? (
            <span className="text-sm text-muted-foreground">No genres selected</span>
          ) : (
            selectedGenres.map((genre) => (
              <Badge key={genre} variant="secondary" className="gap-1">
                {genre}
                <button
                  type="button"
                  onClick={() => handleRemoveGenre(genre)}
                  className="ml-1 hover:text-destructive"
                  aria-label={`Remove ${genre}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <Input
            value={newGenre}
            onChange={(e) => setNewGenre(e.target.value)}
            placeholder="Add a genre..."
            list="genre-suggestions"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddGenre();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={handleAddGenre}>
            <Plus className="h-4 w-4" />
          </Button>
          <datalist id="genre-suggestions">
            {genres
              .filter((g) => !selectedGenres.includes(g))
              .map((g) => (
                <option key={g} value={g} />
              ))}
          </datalist>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Link href="/admin/books">
          <Button type="button" variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </Link>

        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isEditing ? "Saving..." : "Creating..."}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? "Save Changes" : "Create Book"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
