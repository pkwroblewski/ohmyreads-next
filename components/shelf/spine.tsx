import Link from "next/link";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
  authorSurname,
  canNarrow,
  initialTitleFit,
  letteringFamily,
  spineColours,
  spineHeightPct,
  spineTitle,
  spineWidth,
  withoutArticle,
} from "./genre-lettering";
import s from "./shelf.module.css";

export interface ShelfBook {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  pageCount: number | null;
  /** Primary genre (`books.genres[0]`); picks the lettering style. */
  genre: string | null;
  spineColor: string | null;
  spineInk: string | null;
  /** ISO date or timestamp; only the date part is used. */
  finishedAt?: string | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "3 Mar 2026", from the date part only, so server and client agree. */
export function formatFinished(finishedAt: string): string {
  const [y, m, d] = finishedAt.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function monthLabel(finishedAt: string): string {
  return MONTHS[Number(finishedAt.slice(5, 7)) - 1];
}

/** One line describing a book, used for the aria-label and the detail bar. */
export function describeBook(book: ShelfBook): string {
  const parts = [book.title];
  if (book.author) parts.push(book.author);
  if (book.pageCount) parts.push(`${book.pageCount.toLocaleString("en-GB")} pages`);
  if (book.finishedAt) parts.push(`finished ${formatFinished(book.finishedAt)}`);
  return parts.join(", ");
}

export function Spine({ book, lean = false }: { book: ShelfBook; lean?: boolean }) {
  const family = letteringFamily(book.genre);
  const width = spineWidth(book.pageCount);
  const heightPct = spineHeightPct(family, book.title);
  const { bg, text } = spineColours(family, book.spineColor, book.spineInk);
  const title = spineTitle(book.title);
  const fit = initialTitleFit(family, title, width, heightPct);
  const surname = authorSurname(book.author);
  const serifBands = family === "classic" || family === "fantasy";

  return (
    <Link
      href={`/books/${book.slug}`}
      className={cn(s.spine, s[family], lean && s.lean)}
      style={
        {
          "--c": bg,
          "--t": text,
          width: `calc(${width}px * var(--spine-scale))`,
          height: `${heightPct}%`,
        } as CSSProperties
      }
      aria-label={describeBook(book)}
      data-spine=""
      data-detail={describeBook(book)}
    >
      {family === "classic" && <i className={cn(s.band, s.double)} />}
      {family === "fantasy" && <i className={s.band} />}
      {family === "fact" && <i className={s.block} />}
      <span
        className={s.t}
        style={{ fontSize: `${fit.size}px`, fontStretch: `${fit.stretch}%` }}
        data-spine-title=""
        data-full={title}
        data-alt={withoutArticle(title) ?? undefined}
        data-size={fit.size}
        data-stretch={fit.stretch}
        data-narrow={canNarrow(family) ? "1" : undefined}
      >
        {title}
      </span>
      {serifBands && <i className={s.band} />}
      {width >= 20 && surname && (
        <span className={s.a} data-spine-author="" style={{ fontSize: `${Math.max(6, Math.min(width * 0.3, 10)).toFixed(1)}px` }}>
          {surname}
        </span>
      )}
      <i className={s.mark} />
    </Link>
  );
}
