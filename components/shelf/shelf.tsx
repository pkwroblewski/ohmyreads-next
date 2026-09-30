import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Bookend } from "./bookend";
import { letteringFamily, spineColours } from "./genre-lettering";
import { ShelfClient } from "./shelf-client";
import { Spine, formatFinished, monthLabel, type ShelfBook } from "./spine";
import s from "./shelf.module.css";

export type { ShelfBook } from "./spine";

interface ShelfProps {
  /** Books in shelf order (left to right). */
  books: ShelfBook[];
  /** Accessible name, e.g. "2026 shelf". */
  label: string;
  /** Print the month under the first book finished in each month. */
  monthLabels?: boolean;
  /** Lean the last book against its neighbour (a finished year). */
  leanLast?: boolean;
  /** Stand a bookend after the last book (a shelf still filling up). */
  bookend?: boolean;
  /** Offer a table of the same books. */
  listView?: boolean;
  /** Shown beside "Room for your first book." when there are no books. */
  emptyAction?: ReactNode;
  className?: string;
}

/**
 * Books spine-out on shelves. Each flex line is exactly one shelf tall and
 * the background draws a plank under every line, so shelves wrap at any
 * width without JavaScript.
 */
export function Shelf({
  books,
  label,
  monthLabels = false,
  leanLast = false,
  bookend = false,
  listView = true,
  emptyAction,
  className,
}: ShelfProps) {
  if (books.length === 0) {
    return (
      <section aria-label={label} className={cn(s.root, s.empty, className)}>
        <div className={s.emptyCopy}>
          <p>Room for your first book.</p>
          {emptyAction}
        </div>
        <div className={s.shelf}>
          <Bookend side="left" />
          <Bookend />
        </div>
      </section>
    );
  }

  const months = books.map((book) => (monthLabels && book.finishedAt ? monthLabel(book.finishedAt) : null));
  const slots = books.map((book, i) => {
    const month = months[i];
    const showMonth = month !== null && month !== months[i - 1];
    return (
      <li key={book.id} className={s.slot}>
        <Spine book={book} lean={leanLast && !bookend && i === books.length - 1} />
        {showMonth && (
          <span className={s.month} data-month="" aria-hidden="true">
            {month}
          </span>
        )}
      </li>
    );
  });

  const list = listView ? (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Author</th>
            <th scope="col">Genre</th>
            <th scope="col" className={s.n}>
              Pages
            </th>
            <th scope="col" className={s.n}>
              Finished
            </th>
          </tr>
        </thead>
        <tbody>
          {books.map((book) => (
            <tr key={book.id}>
              <td>
                <span
                  className={s.swatch}
                  style={{ background: spineColours(letteringFamily(book.genre), book.spineColor, book.spineInk).bg }}
                  aria-hidden="true"
                />
                <Link href={`/books/${book.slug}`}>{book.title}</Link>
              </td>
              <td>{book.author}</td>
              <td>{book.genre}</td>
              <td className={s.n}>{book.pageCount?.toLocaleString("en-GB")}</td>
              <td className={s.n}>{book.finishedAt ? formatFinished(book.finishedAt) : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : undefined;

  return (
    <section aria-label={label} className={cn(s.root, className)}>
      <ShelfClient list={list} label={label}>
        <ul className={s.shelf}>
          {slots}
          {bookend && (
            <li className={s.slot} aria-hidden="true">
              <span className={s.bookend} />
            </li>
          )}
        </ul>
      </ShelfClient>
    </section>
  );
}
