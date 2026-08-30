"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BookCard } from "@/components/books/book-card";
import { Skeleton } from "@/components/ui/skeleton";
import { AIBookSearch } from "@/components/ai/ai-book-search";
import { cn } from "@/lib/utils";
import type { BookSummary } from "@/types/database";

interface BookBrowserProps {
  initialBooks: BookSummary[];
  genres: string[];
}

type SortOption = "popular" | "newest" | "rating" | "title";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "popular", label: "Popular" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Highest Rated" },
  { value: "title", label: "Title A-Z" },
];

export function BookBrowser({ initialBooks, genres }: BookBrowserProps) {
  const [books, setBooks] = useState<BookSummary[]>(initialBooks);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(initialBooks.length);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showAISearch, setShowAISearch] = useState(false);
  const [showAllGenres, setShowAllGenres] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(event.target as Node)
      ) {
        setShowSortDropdown(false);
      }
    }

    if (showSortDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSortDropdown]);

  // Fetch books from API
  const fetchBooks = useCallback(
    async (
      query: string,
      genre: string | null,
      sort: SortOption,
      pageNum: number,
      append: boolean = false
    ) => {
      setIsLoading(true);

      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (genre) params.set("genre", genre);
        params.set("sort", sort);
        params.set("page", pageNum.toString());
        params.set("limit", "20");

        const response = await fetch(`/api/books/search?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
          console.error("Search error:", data.error);
          return;
        }

        if (append) {
          setBooks((prev) => [...prev, ...data.books]);
        } else {
          setBooks(data.books);
        }

        setTotalCount(data.total);
        setHasMore(data.hasMore);
      } catch (error) {
        console.error("Failed to fetch books:", error);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Debounced search handler
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchBooks(value, selectedGenre, sortBy, 1);
    }, 300);
  };

  // Genre filter handler
  const handleGenreChange = (genre: string | null) => {
    setSelectedGenre(genre);
    setPage(1);
    fetchBooks(searchQuery, genre, sortBy, 1);
  };

  // Sort handler
  const handleSortChange = (sort: SortOption) => {
    setSortBy(sort);
    setShowSortDropdown(false);
    setPage(1);
    fetchBooks(searchQuery, selectedGenre, sort, 1);
  };

  // Load more handler
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchBooks(searchQuery, selectedGenre, sortBy, nextPage, true);
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by title or author..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-12 h-12 text-base"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowAISearch(true)}
          className="h-12 px-4 gap-2 bg-gradient-to-r from-primary/5 to-purple-500/5 border-primary/20 hover:border-primary/40 hover:bg-primary/10"
        >
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">Mood Search</span>
        </Button>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Genre Pills */}
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex flex-wrap gap-2 pb-2">
            <button
              onClick={() => handleGenreChange(null)}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                selectedGenre === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              All
            </button>
            {(showAllGenres ? genres : genres.slice(0, 10)).map((genre) => (
              <button
                key={genre}
                onClick={() => handleGenreChange(genre)}
                className={cn(
                  "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                  selectedGenre === genre
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {genre}
              </button>
            ))}
            {genres.length > 10 && (
              <button
                onClick={() => setShowAllGenres(!showAllGenres)}
                className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors bg-muted/50 text-primary hover:bg-muted border border-primary/20"
              >
                {showAllGenres ? "Show less" : `+${genres.length - 10} more`}
              </button>
            )}
          </div>
        </div>

        {/* Sort Dropdown */}
        <div className="relative flex-shrink-0" ref={sortDropdownRef}>
          <Button
            variant="outline"
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="w-full sm:w-auto justify-between gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>{sortOptions.find((o) => o.value === sortBy)?.label}</span>
          </Button>

          {showSortDropdown && (
            <div className="absolute right-0 top-full mt-2 w-48 z-50 rounded-lg border border-border bg-card shadow-lg py-1 animate-in fade-in-0 zoom-in-95">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSortChange(option.value)}
                  className={cn(
                    "w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors",
                    sortBy === option.value && "text-primary font-medium"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results Count */}
      <p className="text-sm text-muted-foreground">
        {isLoading && page === 1
          ? "Searching..."
          : `${totalCount} book${totalCount !== 1 ? "s" : ""} found`}
      </p>

      {/* Book Grid */}
      {isLoading && page === 1 ? (
        // Loading skeleton grid
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[2/3] rounded-lg" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : books.length === 0 ? (
        // Empty state
        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="mb-4 p-4 rounded-full bg-muted">
            <Search className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No books found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
            Try a different search term or filter.
          </p>
          <Button
            onClick={() => {
              setSearchQuery("");
              setSelectedGenre(null);
              setSortBy("popular");
              setPage(1);
              fetchBooks("", null, "popular", 1);
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        // Book grid - items-stretch ensures uniform height
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6 items-stretch">
          {books.map((book) => (
            <BookCard key={book.id} book={book} variant="grid" showActions />
          ))}
        </div>
      )}

      {/* Load More Button */}
      {hasMore && books.length > 0 && !isLoading && (
        <div className="flex justify-center pt-8">
          <Button
            variant="outline"
            size="lg"
            onClick={handleLoadMore}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}

      {/* Loading more indicator */}
      {isLoading && page > 1 && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* AI Book Search Dialog */}
      <AIBookSearch open={showAISearch} onOpenChange={setShowAISearch} />
    </div>
  );
}

