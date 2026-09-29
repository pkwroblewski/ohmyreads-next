import { LOGO_SPINES, LOGO_VIEWBOX } from "@/components/brand/logo";

// Colours are literals here: ImageResponse (Satori) cannot read CSS tokens.
// They match --foreground, --card and the dark-mode --primary in globals.css;
// the brighter ribbon keeps contrast on the ink tile.
export const BRAND_INK = "#1a1c21";
export const BRAND_PAPER = "#f7f7f3";
export const BRAND_WALL = "#ecede8";
export const BRAND_RIBBON = "#a8122c";
const TILE_RIBBON = "#e2536b";

interface IconTileProps {
  /** Rendered image size in px (square). */
  size: number;
  /** Corner radius in px; 0 for maskable PWA icons, which the OS shapes itself. */
  radius: number;
}

/** Paper mark on an ink tile, for favicons, apple-touch and PWA icons. */
export function IconTile({ size, radius }: IconTileProps) {
  const mark = Math.round(size * 0.62);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_INK,
        borderRadius: radius,
      }}
    >
      <BrandMark size={mark} spine={BRAND_PAPER} ribbon={TILE_RIBBON} />
    </div>
  );
}

interface BrandMarkProps {
  size: number;
  spine: string;
  ribbon: string;
}

/** The logo mark as literal-colour SVG for ImageResponse. */
export function BrandMark({ size, spine, ribbon }: BrandMarkProps) {
  const { leaning, left, ribbon: mid, shelf } = LOGO_SPINES;
  return (
    <svg width={size} height={size} viewBox={LOGO_VIEWBOX}>
      <rect x={leaning.x} y={leaning.y} width={leaning.width} height={leaning.height} rx="1" fill={spine} transform={leaning.rotate} />
      <rect x={left.x} y={left.y} width={left.width} height={left.height} rx="1" fill={spine} />
      <rect x={mid.x} y={mid.y} width={mid.width} height={mid.height} rx="1" fill={ribbon} />
      <rect x={shelf.x} y={shelf.y} width={shelf.width} height={shelf.height} fill={spine} />
    </svg>
  );
}

/**
 * Loads one Google Font weight as TTF, subset to `text`, for ImageResponse
 * (Satori reads ttf/otf/woff, not woff2). Returns null when the fetch fails so
 * the image still renders with the default font.
 */
export async function loadGoogleFont(
  family: string,
  weight: number,
  text: string,
  italic = false
): Promise<ArrayBuffer | null> {
  try {
    const axes = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:${axes}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url)).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!src) return null;
    const res = await fetch(src[1]);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}
