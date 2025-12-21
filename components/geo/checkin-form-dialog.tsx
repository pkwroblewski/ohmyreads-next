"use client";

import { useState, useEffect } from "react";
import { X, MapPin, Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createCheckin } from "@/lib/actions/checkins";
import { createClient } from "@/lib/supabase/client";

interface CheckinFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeId: string;
  placeName: string;
  onSuccess?: () => void;
}

interface UserBook {
  id: string;
  book: {
    id: string;
    title: string;
    author: string;
    cover_url: string | null;
  };
}

export function CheckinFormDialog({
  open,
  onOpenChange,
  placeId,
  placeName,
  onSuccess,
}: CheckinFormDialogProps) {
  const [note, setNote] = useState("");
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userBooks, setUserBooks] = useState<UserBook[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);

  // Fetch user's currently reading books when dialog opens
  useEffect(() => {
    if (open) {
      fetchUserBooks();
    }
  }, [open]);

  const fetchUserBooks = async () => {
    setIsLoadingBooks(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUserBooks([]);
        return;
      }

      // Fetch books user is currently reading
      const { data } = await supabase
        .from("user_books")
        .select(
          `
          id,
          book:books!user_books_book_id_fkey (
            id,
            title,
            author,
            cover_url
          )
        `
        )
        .eq("user_id", user.id)
        .eq("status", "reading")
        .limit(10);

      if (data) {
        setUserBooks(
          data.map((ub) => ({
            id: ub.id,
            book: Array.isArray(ub.book) ? ub.book[0] : ub.book,
          }))
        );
      }
    } catch (err) {
      console.error("Error fetching user books:", err);
    } finally {
      setIsLoadingBooks(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createCheckin({
        placeId,
        bookId: selectedBookId,
        note: note.trim() || null,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      // Reset form
      setNote("");
      setSelectedBookId(null);

      // Show badge notification if any new badges
      if (result.newBadges && result.newBadges.length > 0) {
        // Could integrate with a toast notification system
        console.log("New badges unlocked:", result.newBadges);
      }

      onSuccess?.();
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative bg-background rounded-lg shadow-xl w-full max-w-md mx-4 p-6 z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Check In</h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Place name */}
        <p className="text-muted-foreground mb-4">
          Checking in at <span className="font-medium text-foreground">{placeName}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Book selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              What are you reading? <span className="text-muted-foreground">(optional)</span>
            </label>
            {isLoadingBooks ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading your books...
              </div>
            ) : userBooks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No books currently reading. Start reading a book to include it in your check-in!
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {/* No book option */}
                <button
                  type="button"
                  onClick={() => setSelectedBookId(null)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                    selectedBookId === null
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="w-10 h-14 rounded bg-muted flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className="text-sm">No book selected</span>
                </button>

                {/* Book options */}
                {userBooks.map((ub) => (
                  <button
                    key={ub.book.id}
                    type="button"
                    onClick={() => setSelectedBookId(ub.book.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                      selectedBookId === ub.book.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {ub.book.cover_url ? (
                      <img
                        src={ub.book.cover_url}
                        alt={ub.book.title}
                        className="w-10 h-14 object-cover rounded"
                      />
                    ) : (
                      <div className="w-10 h-14 rounded bg-muted flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ub.book.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {ub.book.author}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <label htmlFor="checkin-note" className="text-sm font-medium mb-2 block">
              Add a note <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="checkin-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What are you up to? Share your reading moment..."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {note.length}/500 characters
            </p>
          </div>

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking in...
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 mr-2" />
                  Check In
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
