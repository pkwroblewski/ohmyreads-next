import Link from "next/link";
import { CoverImage } from "@/components/books/cover-image";
import type { CurrentBook, ProfileShelf, ShelfYear } from "@/lib/queries/shelf";
import { Shelf } from "./shelf";
import { ShareShelf } from "./share-shelf";

interface ProfileShelvesProps {
  shelf: ProfileShelf;
  /** The reader's own profile: the empty shelf offers a first book. */
  isOwnProfile: boolean;
  /** Offer "Share" on each dated year, as this username (public readers only). */
  shareAs?: string;
}

const fmt = (n: number) => n.toLocaleString("en-GB");

/** The book being read, face out, with the ribbon hanging from it. */
function ReadingCard({ book }: { book: CurrentBook }) {
  const pct =
    book.progress ??
    (book.currentPage && book.pageCount ? Math.round((book.currentPage / book.pageCount) * 100) : null);
  return (
    <Link
      href={`/books/${book.slug}`}
      className="grid grid-cols-[72px_minmax(0,1fr)] gap-4 items-start rounded-md border border-border bg-card p-4 hover:border-foreground/40 transition-colors"
    >
      <div className="relative">
        <CoverImage book={book} width={72} height={108} hover={false} className="rounded-sm [filter:var(--book-filter)]" />
        <span
          aria-hidden="true"
          className="absolute -top-1.5 right-3 h-16 w-2.5 bg-primary [clip-path:polygon(0_0,100%_0,100%_100%,50%_86%,0_100%)]"
        />
      </div>
      <div className="min-w-0">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-primary">Reading now</p>
        <p className="font-serif text-lg font-semibold leading-tight text-balance">{book.title}</p>
        {book.author && <p className="mb-3 text-sm text-muted-foreground">{book.author}</p>}
        {pct !== null && (
          <>
            <div className="mb-1.5 h-1 overflow-hidden rounded bg-border" aria-hidden="true">
              <span className="block h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
            </div>
            <p className="text-xs tabular-nums text-muted-foreground">
              {book.currentPage && book.pageCount
                ? `Page ${fmt(book.currentPage)} of ${fmt(book.pageCount)}`
                : `${pct}%`}
            </p>
          </>
        )}
      </div>
    </Link>
  );
}

/**
 * One shelf per year, newest first, then the undated shelf. The current
 * year is still filling up (bookend, "so far"); in a finished year the
 * last book leans on its neighbour.
 */
export function YearShelves({ years, shareAs }: { years: ShelfYear[]; shareAs?: string }) {
  const thisYear = new Date().getFullYear();
  return years.map(({ year, books, pages }) => {
    const ongoing = year === thisYear;
    const id = `shelf-${year ?? "undated"}`;
    return (
      <section key={id} aria-labelledby={id}>
        <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h3 id={id} className="text-3xl font-medium sm:text-4xl [font-variant-numeric:lining-nums]">
            {year ?? "No date"}
          </h3>
          <p className="text-sm tabular-nums text-muted-foreground">
            {books.length} {books.length === 1 ? "book" : "books"}
            {pages > 0 && ` · ${fmt(pages)} pages`}
            {ongoing && " · so far"}
          </p>
          {shareAs && year !== null && (
            <div className="ml-auto self-center">
              <ShareShelf username={shareAs} year={year} />
            </div>
          )}
        </div>
        <Shelf
          books={books}
          label={year ? `${year} shelf` : "Undated shelf"}
          monthLabels={year !== null}
          leanLast={year !== null && !ongoing}
          bookend={ongoing}
        />
      </section>
    );
  });
}

/**
 * A reader's bookcase: what they're reading now, one shelf per year of
 * finished books (newest year first), and want-to-read books face out.
 */
export function ProfileShelves({ shelf, isOwnProfile, shareAs }: ProfileShelvesProps) {
  const { years, reading, want } = shelf;

  return (
    <div className="space-y-10">
      {reading.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {reading.map((book) => (
            <ReadingCard key={book.id} book={book} />
          ))}
        </div>
      )}

      {years.length === 0 ? (
        <Shelf
          books={[]}
          label="Shelf"
          emptyAction={
            isOwnProfile ? (
              <Link
                href="/books"
                className="rounded border border-foreground px-3.5 py-2 text-sm font-bold hover:bg-foreground hover:text-background transition-colors"
              >
                Add a book you loved
              </Link>
            ) : undefined
          }
        />
      ) : (
        <YearShelves years={years} shareAs={shareAs} />
      )}

      {want.length > 0 && (
        <section aria-labelledby="shelf-want">
          <h3 id="shelf-want" className="mb-1 text-2xl font-medium">
            Up next
          </h3>
          <p className="mb-3 text-sm text-muted-foreground">Want to read, face out like a bookshop table.</p>
          <ul className="flex items-end gap-4 overflow-x-auto border-b-[7px] border-plank px-3 pt-4 scrollbar-hide">
            {want.map((book) => (
              <li key={book.id} className="shrink-0">
                <Link href={`/books/${book.slug}`} aria-label={book.author ? `${book.title} by ${book.author}` : book.title}>
                  <CoverImage book={book} width={96} height={144} hover={false} className="rounded-sm [filter:var(--book-filter)]" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
