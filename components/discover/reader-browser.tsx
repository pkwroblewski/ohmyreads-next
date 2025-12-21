"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search, SlidersHorizontal, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ReaderCard } from "./reader-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ReaderWithCompatibility, ReaderSearchFilters } from "@/types/database";

interface ReaderBrowserProps {
  initialReaders: ReaderWithCompatibility[];
  currentUserId?: string;
  initialTotal?: number;
}

type SortOption = "compatibility" | "activity" | "followers" | "recent";

const sortOptions: { value: SortOption; label: string; requiresAuth?: boolean }[] = [
  { value: "compatibility", label: "Best Match", requiresAuth: true },
  { value: "followers", label: "Most Followers" },
  { value: "activity", label: "Most Active" },
  { value: "recent", label: "Recently Joined" },
];

export function ReaderBrowser({
  initialReaders,
  currentUserId,
  initialTotal = 0,
}: ReaderBrowserProps) {
  const [readers, setReaders] = useState<ReaderWithCompatibility[]>(initialReaders);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>(
    currentUserId ? "compatibility" : "followers"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialReaders.length >= 20);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

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

  // Fetch readers from API
  const fetchReaders = useCallback(
    async (
      query: string,
      sort: SortOption,
      pageNum: number,
      append: boolean = false
    ) => {
      setIsLoading(true);

      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        params.set("sort", sort);
        params.set("page", pageNum.toString());
        params.set("limit", "20");

        const response = await fetch(`/api/discover/browse?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
          console.error("Browse error:", data.error);
          return;
        }

        if (append) {
          setReaders((prev) => [...prev, ...data.readers]);
        } else {
          setReaders(data.readers);
        }

        setTotalCount(data.total);
        setHasMore(data.readers.length >= 20);
      } catch (error) {
        console.error("Failed to fetch readers:", error);
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
      fetchReaders(value, sortBy, 1);
    }, 300);
  };

  // Sort handler
  const handleSortChange = (sort: SortOption) => {
    setSortBy(sort);
    setShowSortDropdown(false);
    setPage(1);
    fetchReaders(searchQuery, sort, 1);
  };

  // Load more handler
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchReaders(searchQuery, sortBy, nextPage, true);
  };

  // Filter sort options based on auth
  const availableSortOptions = sortOptions.filter(
    (opt) => !opt.requiresAuth || currentUserId
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Browse Readers</h2>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by name or username..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-12 h-12 text-base"
        />
      </div>

      {/* Filters Row */}
      <div className="flex items-center justify-between gap-4">
        {/* Results Count */}
        <p className="text-sm text-muted-foreground">
          {isLoading && page === 1
            ? "Searching..."
            : `${totalCount} reader${totalCount !== 1 ? "s" : ""} found`}
        </p>

        {/* Sort Dropdown */}
        <div className="relative flex-shrink-0" ref={sortDropdownRef}>
          <Button
            variant="outline"
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="justify-between gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>
              {availableSortOptions.find((o) => o.value === sortBy)?.label}
            </span>
          </Button>

          {showSortDropdown && (
            <div className="absolute right-0 top-full mt-2 w-48 z-50 rounded-lg border border-border bg-card shadow-lg py-1 animate-in fade-in-0 zoom-in-95">
              {availableSortOptions.map((option) => (
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

      {/* Reader Grid */}
      {isLoading && page === 1 ? (
        // Loading skeleton grid
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-10 w-full" />
              <div className="flex gap-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : readers.length === 0 ? (
        // Empty state
        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="mb-4 p-4 rounded-full bg-muted">
            <Users className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No readers found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
            Try a different search term.
          </p>
          <Button
            onClick={() => {
              setSearchQuery("");
              setSortBy(currentUserId ? "compatibility" : "followers");
              setPage(1);
              fetchReaders("", currentUserId ? "compatibility" : "followers", 1);
            }}
            variant="outline"
          >
            Clear filters
          </Button>
        </div>
      ) : (
        // Reader grid
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {readers.map((reader) => (
            <ReaderCard
              key={reader.id}
              reader={reader}
              showCompatibility={!!currentUserId}
            />
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && readers.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoading}
            className="min-w-[160px]"
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
    </div>
  );
}
