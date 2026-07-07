"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, Loader2, X, BookOpen, Heart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { addBookToList, removeBookFromList, likeList } from "@/lib/actions/lists";
import type { ReadingListBookWithBook } from "@/types/database";
import type {
  AutocompleteResponse,
  BookSuggestion,
} from "@/app/api/books/autocomplete/route";

interface ListBookManagerProps {
  listId: string;
  books: ReadingListBookWithBook[];
}

export function ListBookManager({ listId, books }: ListBookManagerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isPending, startTransition] = useTransition();

  // Debounced search using autocomplete endpoint (pattern from unified-search)
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
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(-1);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim().length >= 2) {
      setShowDropdown(true);
      setIsLoading(true);
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(value.trim());
      }, 200);
    } else {
      setShowDropdown(false);
      setSuggestions([]);
      setIsLoading(false);
    }
  };

  const closeDropdown = () => {
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  const handleAddBook = (book: BookSuggestion) => {
    closeDropdown();
    setQuery("");
    setSuggestions([]);
    startTransition(async () => {
      const result = await addBookToList(listId, book.id);
      if (result.success) {
        toast.success(`Added "${book.title}" to list`);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to add book");
      }
    });
  };

  const handleRemoveBook = (bookId: string, title: string) => {
    startTransition(async () => {
      const result = await removeBookFromList(listId, bookId);
      if (result.success) {
        toast.success(`Removed "${title}" from list`);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to remove book");
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > -1 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleAddBook(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        closeDropdown();
        break;
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const inListIds = new Set(books.map((b) => b.book_id));

  return (
    <div className="space-y-6">
      {/* Add-book search */}
      <div className="relative max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search books to add..."
            className="w-full rounded-lg border bg-background pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute z-20 mt-1 w-full rounded-lg border bg-popover shadow-lg overflow-hidden"
          >
            {suggestions.length > 0 ? (
              <ul>
                {suggestions.map((book, index) => {
                  const alreadyAdded = inListIds.has(book.id);
                  return (
                    <li key={book.id}>
                      <button
                        type="button"
                        disabled={alreadyAdded || isPending}
                        onClick={() => handleAddBook(book)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50",
                          index === selectedIndex && "bg-accent"
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {book.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {book.author}
                            {alreadyAdded && " · Already in list"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              !isLoading && (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No books found
                </p>
              )
            )}
          </div>
        )}
      </div>

      {/* Book rows with remove */}
      {books.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {books.map((item) => (
            <li key={item.book_id} className="flex items-center gap-3 p-3">
              <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
                {item.book.cover_url ? (
                  <Image
                    src={item.book.cover_url}
                    alt={item.book.title}
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/books/${item.book.slug}`}
                  className="block truncate text-sm font-medium hover:text-primary transition-colors"
                >
                  {item.book.title}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {item.book.author}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                onClick={() => handleRemoveBook(item.book_id, item.book.title)}
                aria-label={`Remove ${item.book.title} from list`}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="text-muted-foreground">
            No books yet — search above to add your first book.
          </p>
        </div>
      )}
    </div>
  );
}

interface ListLikeButtonProps {
  listId: string;
  isLiked: boolean;
  likesCount: number;
}

export function ListLikeButton({
  listId,
  isLiked,
  likesCount,
}: ListLikeButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleLike = () => {
    startTransition(async () => {
      const result = await likeList(listId);
      if (result.success) {
        router.refresh();
      } else {
        toast.error(
          result.error === "Not authenticated"
            ? "Sign in to like lists"
            : result.error || "Failed to update like"
        );
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={handleLike}
      aria-pressed={isLiked}
    >
      <Heart
        className={cn("h-4 w-4 mr-1.5", isLiked && "fill-current text-red-500")}
      />
      {likesCount}
    </Button>
  );
}
