import { ImageResponse } from "next/og";
import { getYearShelf } from "@/lib/queries/shelf";
import type { ShelfBook } from "@/components/shelf/shelf";
import {
  PER_CHAR,
  letteringFamily,
  spineColours,
  spineHeightPct,
  spineTitle,
  spineWidth,
  type LetteringFamily,
} from "@/components/shelf/genre-lettering";
import { BRAND_INK, BRAND_RIBBON, BRAND_WALL, BrandMark, loadGoogleFont } from "@/lib/brand/app-icon";
import { logError } from "@/lib/utils/log";

// Literal colours: Satori cannot read CSS tokens. Plank = light-mode --plank.
const PLANK = "#34363c";
const MUTED = "#5b5e66";

const FORMATS = {
  og: { width: 1200, height: 630, pad: 48, year: 72, meta: 24 },
  square: { width: 1200, height: 1200, pad: 72, year: 120, meta: 32 },
  story: { width: 1080, height: 1920, pad: 80, year: 160, meta: 38 },
} as const;
type Format = keyof typeof FORMATS;

/** Full-scale shelf geometry, as in `shelf.module.css`. */
const SHELF_H = 188;
const PLANK_H = 8;

const SERIF: ReadonlySet<LetteringFamily> = new Set(["classic", "fantasy", "literary"]);
const UPPER: ReadonlySet<LetteringFamily> = new Set(["classic", "scifi", "thriller", "fact"]);

interface Placed {
  book: ShelfBook;
  family: LetteringFamily;
  w: number;
  h: number;
}

/**
 * The largest scale (≤ 2) at which every book fits the area in rows, and the
 * rows at that scale. Wide spines at 1–5 books, thin ones at hundreds.
 */
function pack(books: ShelfBook[], areaW: number, areaH: number): { scale: number; rows: Placed[][] } {
  let fallback: { scale: number; rows: Placed[][] } | null = null;
  for (let scale = 2; scale >= 0.15; scale -= 0.05) {
    const rows: Placed[][] = [[]];
    let x = 0;
    for (const book of books) {
      const family = letteringFamily(book.genre);
      const w = Math.max(2, Math.round(spineWidth(book.pageCount) * scale));
      if (x + w > areaW && rows[rows.length - 1].length) {
        rows.push([]);
        x = 0;
      }
      const h = Math.round((SHELF_H * scale * spineHeightPct(family, book.title)) / 100);
      rows[rows.length - 1].push({ book, family, w, h });
      x += w;
    }
    const rowH = (SHELF_H + PLANK_H) * scale;
    const gap = 28 * scale;
    fallback = { scale, rows };
    if (rows.length * rowH + (rows.length - 1) * gap <= areaH) return fallback;
  }
  return fallback!;
}

function SpineImage({ p, scale }: { p: Placed; scale: number }) {
  const { bg, text } = spineColours(p.family, p.book.spineColor, p.book.spineInk);
  const title = spineTitle(p.book.title);
  const length = p.h * 0.84;
  const per = PER_CHAR[p.family];
  const cap = Math.min(p.w * 0.52, 16 * scale);
  const size = Math.max(Math.min(cap, length / (title.length * per)), Math.min(cap, 8));
  const upper = UPPER.has(p.family);
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: p.w,
        height: p.h,
        background: bg,
        borderTopLeftRadius: Math.max(1, 2 * scale),
        borderTopRightRadius: Math.max(1, 2 * scale),
        boxShadow: "inset -1px 0 0 rgba(0,0,0,0.18)",
        // No overflow: hidden here: Satori clips children before their
        // transform, which would cut the turned title down to the spine width.
      }}
    >
      {p.w >= 9 && (
        // Laid out horizontally, then turned to read top to bottom.
        <div
          style={{
            position: "absolute",
            left: (p.w - length) / 2,
            top: (p.h - p.w) / 2,
            width: length,
            height: p.w,
            display: "flex",
            alignItems: "center",
            transform: "rotate(90deg)",
            color: text,
            fontSize: size,
            fontFamily: SERIF.has(p.family) ? "Literata" : "Archivo",
            fontWeight: SERIF.has(p.family) ? 600 : 800,
            textTransform: upper ? "uppercase" : "none",
            letterSpacing: upper ? "0.05em" : "0",
          }}
        >
          {/* Centred by text-align, not flex: a flex-centred line that
              overflows loses its first letters to the clip. */}
          <div
            style={{
              width: "100%",
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </div>
        </div>
      )}
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("en-GB");

/**
 * `/api/og/shelf?user=<username>&year=2026&format=og|square|story`: one
 * year of a reader's shelf as a PNG, for link previews (og, the default)
 * and for posting (square, story). 404 for hidden readers and empty years.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const username = params.get("user") ?? "";
  const year = Number(params.get("year"));
  const format = (params.get("format") ?? "og") as Format;
  const thisYear = new Date().getUTCFullYear();

  if (
    !username ||
    username.length > 50 ||
    !Number.isInteger(year) ||
    year < 1900 ||
    year > thisYear + 1 ||
    !(format in FORMATS)
  ) {
    return new Response("Bad request", { status: 400 });
  }

  try {
    const shelf = await getYearShelf(username, year);
    if (!shelf || shelf.books.length === 0) {
      return new Response("Not found", { status: 404 });
    }

    const f = FORMATS[format];
    const heading = `${shelf.name}'s shelf`;
    const meta = `${fmt(shelf.books.length)} ${shelf.books.length === 1 ? "book" : "books"}${
      shelf.pages > 0 ? ` · ${fmt(shelf.pages)} pages` : ""
    }`;
    const footer = `ohmyreads.com/users/${shelf.username}`;

    const headerH = f.year * 1.1 + f.meta * 3.2 + 56;
    const footerH = f.meta * 2;
    const areaW = f.width - f.pad * 2;
    const areaH = f.height - f.pad * 2 - headerH - footerH;
    const { scale, rows } = pack(shelf.books, areaW, areaH);

    // Fonts subset to the characters on the card; a failed fetch falls back.
    const titles = shelf.books.map((b) => spineTitle(b.title)).join("");
    const chars = [...new Set(`${titles}${titles.toUpperCase()}${heading}${meta}${footer}OhMyReads${year}…`)].join("");
    const [serif, sans, sansText] = await Promise.all([
      loadGoogleFont("Literata", 600, chars),
      loadGoogleFont("Archivo", 800, chars),
      loadGoogleFont("Archivo", 500, chars),
    ]);
    const fonts = [
      serif && { name: "Literata", data: serif, weight: 600 as const, style: "normal" as const },
      sans && { name: "Archivo", data: sans, weight: 800 as const, style: "normal" as const },
      sansText && { name: "Archivo", data: sansText, weight: 500 as const, style: "normal" as const },
    ].filter((x) => !!x);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: BRAND_WALL,
            color: BRAND_INK,
            padding: f.pad,
            fontFamily: "Archivo",
            fontWeight: 500,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", height: headerH }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: f.meta * 0.8, fontWeight: 800 }}>
              <BrandMark size={Math.round(f.meta * 1.3)} spine={BRAND_INK} ribbon={BRAND_RIBBON} />
              OhMyReads
            </div>
            <div style={{ display: "flex", marginTop: 16, fontFamily: "Literata", fontWeight: 600, fontSize: f.year, lineHeight: 1 }}>
              {String(year)}
            </div>
            <div style={{ display: "flex", marginTop: 12, fontSize: f.meta, fontWeight: 800 }}>{heading}</div>
            <div style={{ display: "flex", marginTop: 4, fontSize: f.meta * 0.85, color: MUTED }}>{meta}</div>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 28 * scale,
            }}
          >
            {rows.map((row, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "flex-end", height: SHELF_H * scale, paddingLeft: 4 }}>
                  {row.map((p) => (
                    <SpineImage key={p.book.id} p={p} scale={scale} />
                  ))}
                </div>
                <div style={{ display: "flex", height: PLANK_H * scale, background: PLANK }} />
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              height: footerH,
              alignItems: "flex-end",
              fontSize: f.meta * 0.7,
              color: MUTED,
            }}
          >
            {footer}
          </div>
        </div>
      ),
      {
        width: f.width,
        height: f.height,
        // An empty list would switch off next/og's bundled default font too.
        ...(fonts.length ? { fonts } : {}),
        headers: {
          // Public and identical for every viewer (public client, see
          // getYearShelf); an hour's delay for a newly finished book is fine.
          "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    logError("Error generating shelf image", error);
    return new Response("Failed to generate image", { status: 500 });
  }
}
