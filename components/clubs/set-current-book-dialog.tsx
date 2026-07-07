"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, Loader2, Search, BookOpen, BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setCurrentBook } from "@/lib/actions/clubs";
import type {
  AutocompleteResponse,
  BookSuggestion,
} from "@/app/api/books/autocomplete/route";

interface SetCurrentBookDialogProps {
  clubId: string;
  clubSlug?: string;
  variant?: "default" | "outline";
  size?: "sm" | "default";
}

export function SetCurrentBookDialog({
  clubId,
  clubSlug,
  variant = "outline",
  size = "sm",
}: SetCurrentBookDialogProps) {
  const router = useRouter();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/books/autocomplete?q=${encodeURIComponent(searchQuery)}`
      );
      if (response.ok) {
        const data: AutocompleteResponse = await response.json();
        setSuggestions(data.books || []);
        setHasSearched(true);
      } else {
        toast.error("Search failed — try again");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Search failed — try again");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim().length >= 2) {
      setIsLoading(true);
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(value.trim());
      }, 300);
    } else {
      setSuggestions([]);
      setHasSearched(false);
      setIsLoading(false);
    }
  };

  const closeDialog = () => {
    setOpen(false);
    setQuery("");
    setSuggestions([]);
    setHasSearched(false);
  };

  const handleSelect = (book: BookSuggestion) => {
    startTransition(async () => {
      const result = await setCurrentBook(clubId, book.id, clubSlug);

      if (result.success) {
        toast.success(`"${book.title}" is now the current read`);
        closeDialog();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to set current book");
      }
    });
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <BookMarked className="h-4 w-4 mr-2" />
        Set current book
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeDialog}
          />

          {/* Modal */}
          <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-md z-10 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <BookMarked className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Set Current Book</h2>
              </div>
              <button
                onClick={closeDialog}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Search the catalog..."
                  autoFocus
                  className="w-full rounded-lg border bg-background pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {isLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              <div className="max-h-[320px] overflow-y-auto">
                {suggestions.length > 0 ? (
                  <ul className="space-y-1">
                    {suggestions.map((book) => (
                      <li key={book.id}>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleSelect(book)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg p-2 text-left",
                            "hover:bg-muted transition-colors disabled:opacity-50"
                          )}
                        >
                          <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-muted">
                            {book.coverUrl ? (
                              <Image
                                src={book.coverUrl}
                                alt={book.title}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <BookOpen className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {book.title}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {book.author}
                            </p>
                          </div>
                          {isPending && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  hasSearched &&
                  !isLoading && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No books found — try the full catalog
                    </p>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
