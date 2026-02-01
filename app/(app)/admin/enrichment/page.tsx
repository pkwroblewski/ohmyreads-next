"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Sparkles,
  Loader2,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  BookOpen,
  FileText,
  Image,
  Hash,
  Tag,
  ChevronDown,
  ChevronUp,
  Square,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getBooksNeedingEnrichment,
  enrichBooks,
  type BookToEnrich,
  type EnrichmentStats,
  type EnrichmentResult,
} from "@/lib/actions/admin-enrichment";

type Step = "loading" | "select" | "enriching" | "results";

export default function AdminEnrichmentPage() {
  const [step, setStep] = useState<Step>("loading");
  const [stats, setStats] = useState<EnrichmentStats | null>(null);
  const [books, setBooks] = useState<BookToEnrich[]>([]);
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [enrichmentResult, setEnrichmentResult] = useState<EnrichmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Load books on mount
  const loadBooks = useCallback(async () => {
    setStep("loading");
    setError(null);
    try {
      const { stats: newStats, books: newBooks } = await getBooksNeedingEnrichment(100);
      setStats(newStats);
      setBooks(newBooks);
      setSelectedBooks(new Set()); // Reset selection
      setStep("select");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load books");
      setStep("select");
    }
  }, []);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const handleSelectAll = () => {
    if (selectedBooks.size === books.length) {
      setSelectedBooks(new Set());
    } else {
      setSelectedBooks(new Set(books.map((b) => b.id)));
    }
  };

  const handleSelectBook = (bookId: string) => {
    const newSelected = new Set(selectedBooks);
    if (newSelected.has(bookId)) {
      newSelected.delete(bookId);
    } else {
      newSelected.add(bookId);
    }
    setSelectedBooks(newSelected);
  };

  const toggleBookExpand = (bookId: string) => {
    const newExpanded = new Set(expandedBooks);
    if (newExpanded.has(bookId)) {
      newExpanded.delete(bookId);
    } else {
      newExpanded.add(bookId);
    }
    setExpandedBooks(newExpanded);
  };

  const handleEnrich = async () => {
    if (selectedBooks.size === 0) return;

    setStep("enriching");
    setLoading(true);
    setError(null);

    try {
      const result = await enrichBooks(Array.from(selectedBooks));
      setEnrichmentResult(result);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrichment failed");
      setStep("select");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setEnrichmentResult(null);
    setExpandedBooks(new Set());
    await loadBooks();
  };

  // Get missing field icons for a book
  const getMissingFields = (book: BookToEnrich) => {
    const missing: { icon: typeof FileText; label: string }[] = [];
    if (!book.description) missing.push({ icon: FileText, label: "Description" });
    if (!book.cover_url) missing.push({ icon: Image, label: "Cover" });
    if (!book.page_count) missing.push({ icon: Hash, label: "Page Count" });
    if (!book.genres || book.genres.length === 0) missing.push({ icon: Tag, label: "Genres" });
    return missing;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-serif">Book Enrichment</h1>
            <p className="text-muted-foreground">
              Improve book data using external APIs
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleReset} disabled={step === "loading" || loading}>
          <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" aria-hidden="true" />
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-card border">
        {[
          { key: "loading", label: "Load", icon: RefreshCw },
          { key: "select", label: "Select", icon: BookOpen },
          { key: "enriching", label: "Enrich", icon: Sparkles },
          { key: "results", label: "Results", icon: Check },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === s.key
                  ? "bg-primary text-primary-foreground"
                  : ["loading", "select", "enriching", "results"].indexOf(step) >
                    ["loading", "select", "enriching", "results"].indexOf(s.key)
                  ? "bg-green-500 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {["loading", "select", "enriching", "results"].indexOf(step) >
              ["loading", "select", "enriching", "results"].indexOf(s.key) ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <s.icon
                  className={`h-4 w-4 ${
                    (s.key === "loading" || s.key === "enriching") && loading
                      ? "animate-spin"
                      : ""
                  }`}
                  aria-hidden="true"
                />
              )}
            </div>
            <span className={step === s.key ? "font-medium" : "text-muted-foreground"}>
              {s.label}
            </span>
            {i < 3 && <div className="w-12 h-0.5 bg-border" />}
          </div>
        ))}
      </div>

      {/* Loading State */}
      {step === "loading" && (
        <div className="p-12 rounded-xl bg-card border text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" aria-hidden="true" />
          <p className="text-lg font-medium">Loading books...</p>
          <p className="text-muted-foreground">Checking for incomplete data</p>
        </div>
      )}

      {/* Selection Step */}
      {step === "select" && (
        <div className="space-y-4">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-5 gap-4">
              <div className="p-4 rounded-xl bg-card border">
                <p className="text-2xl font-bold">{stats.totalBooks}</p>
                <p className="text-sm text-muted-foreground">Need Enrichment</p>
              </div>
              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-2xl font-bold text-yellow-600">{stats.missingDescription}</p>
                <p className="text-sm text-muted-foreground">No Description</p>
              </div>
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <p className="text-2xl font-bold text-orange-600">{stats.missingCover}</p>
                <p className="text-sm text-muted-foreground">No Cover</p>
              </div>
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-2xl font-bold text-blue-600">{stats.missingPageCount}</p>
                <p className="text-sm text-muted-foreground">No Page Count</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <p className="text-2xl font-bold text-purple-600">{stats.missingGenres}</p>
                <p className="text-sm text-muted-foreground">No Genres</p>
              </div>
            </div>
          )}

          {books.length === 0 ? (
            <div className="p-12 rounded-xl bg-card border text-center">
              <Check className="h-12 w-12 mx-auto mb-4 text-green-500" aria-hidden="true" />
              <p className="text-lg font-medium text-green-600">All books have complete data!</p>
              <p className="text-muted-foreground">No enrichment needed at this time.</p>
            </div>
          ) : (
            <>
              {/* Book Selection Table */}
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
                    aria-label={selectedBooks.size === books.length ? "Deselect all books" : "Select all books"}
                  >
                    {selectedBooks.size === books.length && books.length > 0 ? (
                      <CheckSquare className="h-5 w-5 text-primary" aria-hidden="true" />
                    ) : (
                      <Square className="h-5 w-5" aria-hidden="true" />
                    )}
                    <span className="text-sm font-medium">
                      {selectedBooks.size === 0
                        ? "Select All"
                        : `${selectedBooks.size} selected`}
                    </span>
                  </button>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-muted/30 sticky top-0">
                      <tr>
                        <th className="w-10 p-3"></th>
                        <th className="text-left p-3 font-medium">Title</th>
                        <th className="text-left p-3 font-medium">Author</th>
                        <th className="text-left p-3 font-medium">Missing</th>
                        <th className="w-10 p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {books.map((book) => {
                        const missingFields = getMissingFields(book);
                        return (
                          <>
                            <tr
                              key={book.id}
                              className="hover:bg-muted/30 cursor-pointer"
                              onClick={() => toggleBookExpand(book.id)}
                            >
                              <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleSelectBook(book.id)}
                                  className="hover:text-primary transition-colors"
                                  aria-label={selectedBooks.has(book.id) ? `Deselect ${book.title}` : `Select ${book.title}`}
                                >
                                  {selectedBooks.has(book.id) ? (
                                    <CheckSquare className="h-5 w-5 text-primary" aria-hidden="true" />
                                  ) : (
                                    <Square className="h-5 w-5" aria-hidden="true" />
                                  )}
                                </button>
                              </td>
                              <td className="p-3">
                                <span className="font-medium line-clamp-1">{book.title}</span>
                              </td>
                              <td className="p-3 text-muted-foreground line-clamp-1">
                                {book.author}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1">
                                  {missingFields.map((field) => (
                                    <span
                                      key={field.label}
                                      className="p-1 rounded bg-muted"
                                      title={field.label}
                                    >
                                      <field.icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                      <span className="sr-only">{field.label}</span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="p-3">
                                {expandedBooks.has(book.id) ? (
                                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                                )}
                              </td>
                            </tr>
                            {expandedBooks.has(book.id) && (
                              <tr key={`${book.id}-details`}>
                                <td colSpan={5} className="p-4 bg-muted/30">
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="text-muted-foreground">ISBN</p>
                                      <p>{book.isbn || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Page Count</p>
                                      <p>{book.page_count || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Genres</p>
                                      <p>
                                        {book.genres && book.genres.length > 0
                                          ? book.genres.join(", ")
                                          : "—"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Added</p>
                                      <p>{new Date(book.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div className="col-span-2">
                                      <p className="text-muted-foreground">Description</p>
                                      <p className="line-clamp-2">
                                        {book.description || "No description"}
                                      </p>
                                    </div>
                                    <div className="col-span-2">
                                      <p className="text-muted-foreground">Cover</p>
                                      <p>{book.cover_url ? "Has cover" : "No cover"}</p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Select books to enrich from Google Books and Open Library APIs
                </p>
                <Button
                  onClick={handleEnrich}
                  disabled={selectedBooks.size === 0 || loading}
                >
                  <Sparkles className="h-4 w-4 mr-2" aria-hidden="true" />
                  Enrich {selectedBooks.size} Book{selectedBooks.size !== 1 ? "s" : ""}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Enriching State */}
      {step === "enriching" && (
        <div className="p-12 rounded-xl bg-card border text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" aria-hidden="true" />
          <p className="text-lg font-medium">Enriching books...</p>
          <p className="text-muted-foreground">
            Fetching data from Google Books and Open Library
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Processing {selectedBooks.size} book{selectedBooks.size !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Results Step */}
      {step === "results" && enrichmentResult && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-card border">
              <p className="text-2xl font-bold">{enrichmentResult.totalProcessed}</p>
              <p className="text-sm text-muted-foreground">Total Processed</p>
            </div>
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <p className="text-2xl font-bold text-green-600">{enrichmentResult.updated}</p>
              <p className="text-sm text-muted-foreground">Updated</p>
            </div>
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-2xl font-bold text-yellow-600">{enrichmentResult.skipped}</p>
              <p className="text-sm text-muted-foreground">No New Data</p>
            </div>
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-2xl font-bold text-red-600">{enrichmentResult.failed}</p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
          </div>

          {/* Results Table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-medium">Title</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Fields Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {enrichmentResult.results.map((result) => (
                    <tr key={result.bookId} className="hover:bg-muted/30">
                      <td className="p-3 font-medium">{result.title}</td>
                      <td className="p-3">
                        {result.success && result.fieldsUpdated.length > 0 && (
                          <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                            <Check className="h-3 w-3 mr-1" aria-hidden="true" />
                            Updated
                          </Badge>
                        )}
                        {result.success && result.fieldsUpdated.length === 0 && (
                          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
                            <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" />
                            No New Data
                          </Badge>
                        )}
                        {!result.success && (
                          <Badge variant="destructive">
                            <X className="h-3 w-3 mr-1" aria-hidden="true" />
                            Failed
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {result.error
                          ? result.error
                          : result.fieldsUpdated.length > 0
                          ? result.fieldsUpdated.join(", ")
                          : "No enrichment data found"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handleReset}>
              Enrich More Books
            </Button>
            <Link href="/admin/books">
              <Button>View All Books</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
