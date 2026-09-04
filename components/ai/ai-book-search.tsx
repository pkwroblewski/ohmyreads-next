"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";
import { useRef, useEffect, useState, useMemo, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  X,
  Sparkles,
  Send,
  Loader2,
  BookOpen,
  ExternalLink,
  Search,
  Plus,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/books/cover-image";
import { AddToShelfButton } from "@/components/books/add-to-shelf-button";
import { BuyLinks } from "@/components/books/buy-links";
import { importAndAddToShelf, type ExternalBookData } from "@/lib/actions/books";
import { chatErrorMessage } from "@/lib/ai/chat-error";
import { toast } from "sonner";
import Link from "next/link";

interface AIBookSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}

interface BookResult {
  id?: string;
  title: string;
  author: string;
  slug?: string;
  description?: string;
  coverUrl?: string | null;
  genres?: string[];
  rating?: number | null;
  ratingsCount?: number;
  externalId?: string;
  source?: string;
  // Additional fields for external books
  isbn?: string;
  pageCount?: number;
  publishedDate?: string;
}

const WELCOME_MESSAGE: UIMessage = {
  id: "welcome",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Hi! I'm your AI book finder. Tell me what kind of book you're looking for - describe the mood, themes, genre, or just what you're in the mood for. For example:\n\n• \"A cozy mystery set in a small village\"\n• \"Something like Project Hail Mary but more philosophical\"\n• \"A page-turner with unreliable narrator\"\n• \"Fantasy with found family vibes\"\n\nWhat are you in the mood to read?",
    },
  ],
};

export function AIBookSearch({ open, onOpenChange, initialQuery }: AIBookSearchProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [hasAutoSent, setHasAutoSent] = useState(false);

  // Create transport with custom API endpoint
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/book-search",
      }),
    []
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
    messages: [WELCOME_MESSAGE],
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Extract all books from all messages
  const allBooks = useMemo(() => {
    const books: BookResult[] = [];
    for (const message of messages) {
      books.push(...extractBooksFromMessage(message));
    }
    // Deduplicate by id or title+author
    const seen = new Set<string>();
    return books.filter((book) => {
      const key = book.id || `${book.title}-${book.author}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [messages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Scroll results into view when books are found
  useEffect(() => {
    if (allBooks.length > 0 && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [allBooks.length]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Auto-send initial query if provided
  useEffect(() => {
    if (open && initialQuery && !hasAutoSent && !isLoading) {
      queueMicrotask(() => setHasAutoSent(true));
      sendMessage({
        role: "user",
        parts: [{ type: "text", text: initialQuery }],
      });
    }
  }, [open, initialQuery, hasAutoSent, isLoading, sendMessage]);

  // Reset chat when dialog closes
  const handleClose = () => {
    setMessages([WELCOME_MESSAGE]);
    setInputValue("");
    setHasAutoSent(false);
    onOpenChange(false);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    sendMessage({
      role: "user",
      parts: [{ type: "text", text: inputValue.trim() }],
    });
    setInputValue("");
  };

  // Extract text content from message parts
  const getMessageText = (message: UIMessage): string => {
    if (!message.parts) return "";
    return message.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-3xl h-[700px] max-h-[85vh] z-10 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold">AI Book Finder</h2>
              <p className="text-xs text-muted-foreground">
                Describe what you want to read
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close AI book finder"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Messages */}
          <div className="p-4 space-y-4">
            {messages.map((message) => {
              const text = getMessageText(message);

              // Skip empty messages
              if (!text && message.role === "assistant") return null;

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {text && (
                      <div className="text-sm whitespace-pre-wrap">{text}</div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start" role="status" aria-live="polite">
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <Search className="h-4 w-4" aria-hidden="true" />
                    Searching for books...
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex justify-center">
                <div className="bg-destructive/10 text-destructive rounded-lg px-4 py-2 text-sm">
                  {chatErrorMessage(error)}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Book Results Section */}
          {allBooks.length > 0 && (
            <div ref={resultsRef} className="border-t bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
                <h3 className="font-medium text-sm">
                  Found {allBooks.length} book{allBooks.length !== 1 ? "s" : ""}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allBooks.slice(0, 9).map((book, index) => (
                  <BookResultCard key={book.id || index} book={book} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t bg-background">
          <div className="flex items-center gap-2">
            <label htmlFor="ai-search-input" className="sr-only">
              Describe the book you&apos;re looking for
            </label>
            <input
              id="ai-search-input"
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Describe the book you're looking for..."
              className="flex-1 bg-muted rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !inputValue.trim()}
              className="rounded-full h-10 w-10"
              aria-label={isLoading ? "Searching for books" : "Search for books"}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Powered by AI. Results may vary.
          </p>
        </form>
      </div>
    </div>
  );
}

/**
 * Extract book results from tool invocations in message parts
 */
function extractBooksFromMessage(message: UIMessage): BookResult[] {
  const books: BookResult[] = [];

  if (!message.parts) return books;

  for (const part of message.parts) {
    // Check for tool parts with output containing books
    // Tool parts have type like "tool-searchBooks" or "tool-searchExternalBooks"
    if (
      typeof part.type === "string" &&
      part.type.startsWith("tool-") &&
      "state" in part &&
      part.state === "output-available" &&
      "output" in part &&
      part.output &&
      typeof part.output === "object" &&
      "books" in part.output &&
      Array.isArray((part.output as { books: BookResult[] }).books)
    ) {
      books.push(...(part.output as { books: BookResult[] }).books);
    }
  }

  return books;
}

function BookResultCard({ book }: { book: BookResult }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [addedToShelf, setAddedToShelf] = useState(false);

  const isInCatalog = !!book.slug && !!book.id;
  const isExternal = !isInCatalog && !!book.externalId;

  // Prepare cover data for CoverImage component
  const coverData = {
    cover_url: book.coverUrl || null,
    google_books_id: book.source === "google_books" ? book.externalId || null : null,
    isbn: book.isbn || null,
    open_library_cover_id: null,
    title: book.title,
    author: book.author,
  };

  // Handle adding external book to shelf
  const handleAddExternalToShelf = () => {
    startTransition(async () => {
      const externalBookData: ExternalBookData = {
        title: book.title,
        author: book.author,
        description: book.description,
        coverUrl: book.coverUrl,
        isbn: book.isbn,
        googleBooksId: book.source === "google_books" ? book.externalId : undefined,
        openLibraryId: book.source === "openlibrary" ? book.externalId : undefined,
        genres: book.genres,
        pageCount: book.pageCount,
        publishedDate: book.publishedDate,
      };

      const result = await importAndAddToShelf(externalBookData, "want_to_read");

      if (!result.success) {
        if (result.error === "Not authenticated") {
          router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
          return;
        }
        toast.error(result.error);
        return;
      }

      setAddedToShelf(true);
      toast.success("Book added to your shelf!");

      // Navigate to book page after short delay
      if (result.slug) {
        setTimeout(() => {
          router.push(`/books/${result.slug}`);
        }, 1000);
      }
    });
  };

  return (
    <div className="group flex flex-col bg-background rounded-lg border p-3 transition-shadow hover:shadow-md">
      {/* Cover and Info */}
      <div className="flex gap-3">
        {/* Cover */}
        <div className="flex-shrink-0">
          <CoverImage book={coverData} size="sm" hover={false} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {isInCatalog ? (
                <Link
                  href={`/books/${book.slug}`}
                  className="font-medium text-sm line-clamp-2 hover:text-primary transition-colors"
                >
                  {book.title}
                </Link>
              ) : (
                <h4 className="font-medium text-sm line-clamp-2">
                  {book.title}
                </h4>
              )}
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {book.author}
              </p>
            </div>
            {isInCatalog ? (
              <Link
                href={`/books/${book.slug}`}
                className="flex-shrink-0 text-primary hover:text-primary/80"
                aria-label={`View ${book.title} details`}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : isExternal ? (
              <span className="flex-shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                External
              </span>
            ) : null}
          </div>

          {/* Rating */}
          {book.rating && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-yellow-500">★</span>
              <span className="text-xs font-medium">
                {book.rating.toFixed(1)}
              </span>
              {book.ratingsCount && (
                <span className="text-xs text-muted-foreground">
                  ({book.ratingsCount.toLocaleString()})
                </span>
              )}
            </div>
          )}

          {/* Genres */}
          {book.genres && book.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {book.genres.slice(0, 2).map((genre) => (
                <span
                  key={genre}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                >
                  {genre}
                </span>
              ))}
              {book.genres.length > 2 && (
                <span className="text-[10px] text-muted-foreground">
                  +{book.genres.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {book.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
          {book.description}
        </p>
      )}

      {/* Action Buttons */}
      <div className="mt-3 pt-2 border-t flex items-center gap-2">
        {/* Add to Shelf - for catalog books */}
        {isInCatalog && book.id && (
          <AddToShelfButton bookId={book.id} />
        )}

        {/* Add to Shelf - for external books */}
        {isExternal && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddExternalToShelf}
            disabled={isPending || addedToShelf}
            className="text-xs h-8"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Adding...
              </>
            ) : addedToShelf ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Added
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add to Shelf
              </>
            )}
          </Button>
        )}

        {/* Buy Links - for all books */}
        <BuyLinks
          book={{
            isbn: book.isbn,
            title: book.title,
            author: book.author,
          }}
          size="sm"
          variant="ghost"
        />
      </div>
    </div>
  );
}
