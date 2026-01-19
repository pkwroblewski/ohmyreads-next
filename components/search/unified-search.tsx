"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, X, Loader2, Star, ArrowRight, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIBookSearch } from "@/components/ai/ai-book-search";
import type {
  AutocompleteResponse,
  AuthorSuggestion,
  BookSuggestion,
} from "@/app/api/books/autocomplete/route";

const MOOD_PILLS = [
  { label: "Cozy", query: "a cozy, comforting read perfect for a rainy day" },
  { label: "Thrilling", query: "a fast-paced thriller I can't put down" },
  { label: "Mind-bending", query: "a mind-bending book with twists and philosophical themes" },
  { label: "Funny", query: "a light, funny book to lift my spirits" },
  { label: "Epic", query: "an epic adventure with great world-building" },
];

interface UnifiedSearchProps {
  placeholder?: string;
  showMoodPills?: boolean;
  autoFocus?: boolean;
}

export function UnifiedSearch({
  placeholder = "Search books, authors, or describe a mood...",
  showMoodPills = true,
  autoFocus = false,
}: UnifiedSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [query, setQuery] = useState("");
  const [authors, setAuthors] = useState<AuthorSuggestion[]>([]);
  const [books, setBooks] = useState<BookSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Total items for keyboard nav: authors + books + optional actions
  const totalItems = authors.length + books.length;

  // AI modal state
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiInitialQuery, setAIInitialQuery] = useState<string | undefined>();

  // Debounced search using autocomplete endpoint
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setAuthors([]);
      setBooks([]);
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
        setAuthors(data.authors || []);
        setBooks(data.books || []);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debounce
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
      setAuthors([]);
      setBooks([]);
      setIsLoading(false);
    }
  };

  // Handle keyboard navigation (authors first, then books, then AI option)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;

    // Max index: authors + books + 1 (for AI search option)
    const maxIndex = totalItems;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < maxIndex ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > -1 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < authors.length) {
          // Author selected - search for their books
          handleAuthorSelect(authors[selectedIndex]);
        } else if (selectedIndex >= authors.length && selectedIndex < totalItems) {
          // Book selected
          const bookIndex = selectedIndex - authors.length;
          handleBookSelect(books[bookIndex]);
        } else if (selectedIndex === totalItems) {
          // AI search selected
          handleAISearch();
        } else if (totalItems === 0 && query.trim()) {
          // No results - trigger AI search
          handleAISearch();
        }
        break;
      case "Escape":
        closeDropdown();
        break;
    }
  };

  // Close dropdown
  const closeDropdown = () => {
    setShowDropdown(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  };

  // Handle click outside
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

  // Handle author selection - search for all their books
  const handleAuthorSelect = (author: AuthorSuggestion) => {
    router.push(`/books?q=${encodeURIComponent(author.name)}`);
    closeDropdown();
    setQuery("");
  };

  // Handle book selection
  const handleBookSelect = (book: BookSuggestion) => {
    router.push(`/books/${book.slug}`);
    closeDropdown();
    setQuery("");
  };

  // Handle AI search
  const handleAISearch = (initialQuery?: string) => {
    setAIInitialQuery(initialQuery || query.trim() || undefined);
    setShowAIModal(true);
    closeDropdown();
  };

  // Handle mood pill click
  const handleMoodClick = (moodQuery: string) => {
    setAIInitialQuery(moodQuery);
    setShowAIModal(true);
  };

  // Clear input
  const handleClear = () => {
    setQuery("");
    setAuthors([]);
    setBooks([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  return (
    <>
      <div className="bg-gradient-to-br from-primary/5 via-background to-accent/5 rounded-xl border border-border/50 p-4 sm:p-6">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= 2 && setShowDropdown(true)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={cn(
              "w-full pl-12 pr-12 py-3 text-base rounded-xl",
              "bg-background border-2 border-border",
              "focus:outline-none focus:ring-0 focus:border-primary",
              "placeholder:text-muted-foreground",
              "transition-colors"
            )}
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          {isLoading && (
            <Loader2 className="absolute right-12 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}

          {/* Dropdown Results */}
          {showDropdown && (
            <div
              ref={dropdownRef}
              className={cn(
                "absolute top-full left-0 right-0 mt-2 z-50",
                "bg-background border border-border rounded-xl shadow-lg",
                "max-h-[60vh] overflow-y-auto"
              )}
            >
              {isLoading && totalItems === 0 ? (
                <div className="p-6 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Searching...</p>
                </div>
              ) : totalItems > 0 ? (
                <>
                  {/* Authors Section */}
                  {authors.length > 0 && (
                    <div className="py-2">
                      <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Authors
                      </div>
                      {authors.map((author, index) => (
                        <button
                          key={author.name}
                          onClick={() => handleAuthorSelect(author)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 text-left",
                            "hover:bg-muted/50 transition-colors",
                            selectedIndex === index && "bg-muted"
                          )}
                        >
                          <div className="w-8 h-8 flex-shrink-0 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {author.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {author.bookCount} {author.bookCount === 1 ? "book" : "books"}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Books Section */}
                  {books.length > 0 && (
                    <div className={cn("py-2", authors.length > 0 && "border-t border-border")}>
                      <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Books
                      </div>
                      {books.map((book, index) => {
                        const itemIndex = authors.length + index;
                        return (
                          <button
                            key={book.id}
                            onClick={() => handleBookSelect(book)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2.5 text-left",
                              "hover:bg-muted/50 transition-colors",
                              selectedIndex === itemIndex && "bg-muted"
                            )}
                          >
                            {/* Cover thumbnail */}
                            <div className="w-8 h-12 flex-shrink-0 rounded overflow-hidden bg-muted">
                              {book.coverUrl ? (
                                <img
                                  src={book.coverUrl}
                                  alt={book.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground">
                                  No cover
                                </div>
                              )}
                            </div>
                            {/* Book info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {book.title}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {book.author}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* AI Search CTA */}
                  <button
                    onClick={() => handleAISearch()}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3",
                      "border-t border-border",
                      "hover:bg-primary/5 transition-colors text-sm",
                      selectedIndex === totalItems && "bg-muted"
                    )}
                  >
                    <span className="flex items-center gap-2 text-primary">
                      <Sparkles className="w-4 h-4" />
                      Can't find it? Try mood search
                    </span>
                    <ArrowRight className="w-4 h-4 text-primary" />
                  </button>
                </>
              ) : query.length >= 2 && !isLoading ? (
                <div className="p-6 text-center">
                  <p className="text-muted-foreground mb-3">
                    No results found for "{query}"
                  </p>
                  <button
                    onClick={() => handleAISearch()}
                    className={cn(
                      "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
                      "bg-primary text-primary-foreground",
                      "hover:bg-primary/90 transition-colors text-sm font-medium"
                    )}
                  >
                    <Sparkles className="w-4 h-4" />
                    Try mood search instead
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Mood Pills */}
        {showMoodPills && (
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="text-xs text-muted-foreground">Quick moods:</span>
            {MOOD_PILLS.map((mood) => (
              <button
                key={mood.label}
                onClick={() => handleMoodClick(mood.query)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2.5 text-sm rounded-full",
                  "min-h-[44px]", // Accessibility: 44px minimum touch target
                  "bg-muted hover:bg-primary hover:text-primary-foreground",
                  "border border-border/50 hover:border-primary",
                  "transition-all duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50"
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {mood.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* AI Search Modal */}
      <AIBookSearch
        open={showAIModal}
        onOpenChange={(open) => {
          setShowAIModal(open);
          if (!open) {
            setAIInitialQuery(undefined);
          }
        }}
        initialQuery={aiInitialQuery}
      />
    </>
  );
}
