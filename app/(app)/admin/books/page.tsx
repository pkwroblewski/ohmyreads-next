"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BookOpen,
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { adminGetBooks, adminDeleteBook, adminGetGenres, type BookFilters } from "@/lib/actions/admin-books";
import { Book } from "@/types/database";

export default function AdminBooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [genres, setGenres] = useState<string[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState<string>("all");
  const [sortBy, setSortBy] = useState<BookFilters["sortBy"]>("created_at");
  const [sortOrder, setSortOrder] = useState<BookFilters["sortOrder"]>("desc");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    const result = await adminGetBooks({
      search: search || undefined,
      genre: genre !== "all" ? genre : undefined,
      sortBy,
      sortOrder,
      page,
      limit,
    });

    if (result.success) {
      setBooks(result.books || []);
      setTotal(result.total || 0);
      setTotalPages(result.totalPages || 0);
    }
    setLoading(false);
  }, [search, genre, sortBy, sortOrder, page]);

  const fetchGenres = useCallback(async () => {
    const result = await adminGetGenres();
    if (result.success) {
      setGenres(result.genres || []);
    }
  }, []);

  useEffect(() => {
    fetchGenres();
  }, [fetchGenres]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchBooks();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchBooks]);

  const handleDelete = async () => {
    if (!bookToDelete) return;

    setDeleting(true);
    const result = await adminDeleteBook(bookToDelete.id);
    setDeleting(false);

    if (result.success) {
      setDeleteDialogOpen(false);
      setBookToDelete(null);
      fetchBooks();
    }
  };

  const openDeleteDialog = (book: Book) => {
    setBookToDelete(book);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-serif">Manage Books</h1>
            <p className="text-muted-foreground">
              {total.toLocaleString()} books in catalog
            </p>
          </div>
        </div>
        <Link href="/admin/books/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Book
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-card border">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, author, or ISBN..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        </div>

        <Select
          value={genre}
          onValueChange={(v) => {
            setGenre(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by genre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genres</SelectItem>
            {genres.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sortBy}
          onValueChange={(v) => setSortBy(v as BookFilters["sortBy"])}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Date Added</SelectItem>
            <SelectItem value="title">Title</SelectItem>
            <SelectItem value="author">Author</SelectItem>
            <SelectItem value="ratings_count">Popularity</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sortOrder}
          onValueChange={(v) => setSortOrder(v as BookFilters["sortOrder"])}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest</SelectItem>
            <SelectItem value="asc">Oldest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Books Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <BookOpen className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No books found</p>
            <p className="text-sm">
              {search ? "Try adjusting your search" : "Add your first book to get started"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium">Book</th>
                  <th className="text-left p-4 font-medium hidden md:table-cell">Author</th>
                  <th className="text-left p-4 font-medium hidden lg:table-cell">Genres</th>
                  <th className="text-center p-4 font-medium hidden sm:table-cell">Rating</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {books.map((book) => (
                  <tr key={book.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {book.cover_url ? (
                          <img
                            src={book.cover_url}
                            alt={`Cover of ${book.title}`}
                            className="w-10 h-14 rounded object-cover bg-muted"
                          />
                        ) : (
                          <div className="w-10 h-14 rounded bg-muted flex items-center justify-center">
                            <BookOpen className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <Link
                            href={`/books/${book.slug}`}
                            className="font-medium hover:text-primary transition-colors line-clamp-1"
                          >
                            {book.title}
                          </Link>
                          <p className="text-sm text-muted-foreground md:hidden">
                            {book.author}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <span className="text-muted-foreground">{book.author}</span>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(book.genres || []).slice(0, 2).map((g) => (
                          <Badge key={g} variant="secondary" className="text-xs">
                            {g}
                          </Badge>
                        ))}
                        {(book.genres || []).length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{book.genres.length - 2}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center hidden sm:table-cell">
                      {book.average_rating ? (
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-4 w-4 fill-accent text-accent" />
                          <span>{book.average_rating.toFixed(1)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/books/${book.id}`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(book)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({total} books)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Book
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{bookToDelete?.title}</strong> by{" "}
              {bookToDelete?.author}? This will also delete all associated reviews and user
              shelves. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Book"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
