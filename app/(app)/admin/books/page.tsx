import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Plus, Edit, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AdminSearchInput,
  AdminSelectFilter,
} from "@/components/admin/admin-filters";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { BookDeleteButton } from "@/components/admin/book-delete-button";
import {
  adminGetBooks,
  adminGetGenres,
  type BookFilters,
} from "@/lib/queries/admin-books";
import {
  toAdminParams,
  readPage,
  readEnum,
  type RawSearchParams,
} from "@/lib/admin/search-params";

export const metadata: Metadata = {
  title: "Manage Books | Admin",
  robots: { index: false, follow: false },
};

const PATHNAME = "/admin/books";
const LIMIT = 20;

const SORT_FIELDS = [
  "created_at",
  "title",
  "author",
  "ratings_count",
] as const satisfies readonly NonNullable<BookFilters["sortBy"]>[];

const SORT_ORDERS = ["desc", "asc"] as const;

interface PageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function AdminBooksPage({ searchParams }: PageProps) {
  const params = toAdminParams(await searchParams);

  const search = params.search ?? "";
  const sortBy = readEnum(params, "sortBy", SORT_FIELDS, "created_at");
  const sortOrder = readEnum(params, "sortOrder", SORT_ORDERS, "desc");
  const page = readPage(params);

  const genresResult = await adminGetGenres();
  const genres = genresResult.success ? genresResult.genres ?? [] : [];

  // A genre that is not in the catalog would return an empty page with no
  // explanation, so an unknown value falls back to "all".
  const genre =
    params.genre && genres.includes(params.genre) ? params.genre : "all";

  const result = await adminGetBooks({
    search: search || undefined,
    genre: genre !== "all" ? genre : undefined,
    sortBy,
    sortOrder,
    page,
    limit: LIMIT,
  });

  const books = result.success ? result.books ?? [] : [];
  const total = result.success ? result.total ?? 0 : 0;
  const totalPages = result.success ? result.totalPages ?? 0 : 0;

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
          <AdminSearchInput
            pathname={PATHNAME}
            params={params}
            placeholder="Search by title, author, or ISBN..."
          />
        </div>

        <AdminSelectFilter
          pathname={PATHNAME}
          params={params}
          name="genre"
          value={genre}
          defaultValue="all"
          placeholder="Filter by genre"
          className="w-[180px]"
          options={[
            { value: "all", label: "All Genres" },
            ...genres.map((g) => ({ value: g, label: g })),
          ]}
        />

        <AdminSelectFilter
          pathname={PATHNAME}
          params={params}
          name="sortBy"
          value={sortBy}
          defaultValue="created_at"
          placeholder="Sort by"
          options={[
            { value: "created_at", label: "Date Added" },
            { value: "title", label: "Title" },
            { value: "author", label: "Author" },
            { value: "ratings_count", label: "Popularity" },
          ]}
        />

        <AdminSelectFilter
          pathname={PATHNAME}
          params={params}
          name="sortOrder"
          value={sortOrder}
          defaultValue="desc"
          className="w-[120px]"
          options={[
            { value: "desc", label: "Newest" },
            { value: "asc", label: "Oldest" },
          ]}
        />
      </div>

      {/* Books Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {!result.success ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <BookOpen className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Could not load books</p>
            <p className="text-sm">{result.error || "Please try again."}</p>
          </div>
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <BookOpen className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No books found</p>
            <p className="text-sm">
              {search
                ? "Try adjusting your search"
                : "Add your first book to get started"}
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
                          // eslint-disable-next-line @next/next/no-img-element -- URL host is not guaranteed to be in ALLOWED_IMAGE_HOSTS
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
                            +{(book.genres || []).length - 2}
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
                        <BookDeleteButton
                          bookId={book.id}
                          title={book.title}
                          author={book.author}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination
          pathname={PATHNAME}
          params={params}
          page={page}
          totalPages={totalPages}
          total={total}
          label="books"
        />
      </div>
    </div>
  );
}
