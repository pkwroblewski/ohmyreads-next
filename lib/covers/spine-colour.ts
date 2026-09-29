/**
 * Spine colours for the shelf (Shelf design build, Task 4).
 *
 * Ported from the shelf prototype (`.claude/prototypes/shelf/build-data.mjs`),
 * where it held up on 97 real covers. The colour comes from the cover's left
 * third, where a real jacket wraps onto the spine. Pixels are bucketed and
 * saturated buckets are favoured, so a cover with black lettering on a green
 * jacket gives a green spine; near-black or near-white only wins when the
 * cover really is mostly that.
 */

import sharp from "sharp";

export interface SpineColours {
  /** Spine colour, `#rrggbb`. */
  color: string;
  /** Lettering colour from the cover when one clearly contrasts, else null. */
  ink: string | null;
}

interface Bucket {
  r: number;
  g: number;
  b: number;
  n: number;
  score: number;
}

/** Share of the strip a lettering colour must cover to count. */
const MIN_INK_SHARE = 0.02;
/** Luminance gap (0–255) between spine and lettering colour. */
const MIN_INK_LUMINANCE_GAP = 90;

const hex = (c: { r: number; g: number; b: number }) =>
  "#" +
  [c.r, c.g, c.b]
    .map((v) => Math.round(v).toString(16).padStart(2, "0"))
    .join("");

const luminance = (c: { r: number; g: number; b: number }) =>
  0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

export async function spineColours(buffer: Buffer): Promise<SpineColours> {
  // Apply EXIF orientation first so the left third is the real left edge.
  const { data: upright, info } = await sharp(buffer)
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const { data } = await sharp(upright)
    .extract({ left: 0, top: 0, width: Math.max(1, Math.floor(width / 3)), height })
    .resize(24, 72, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const sums = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let p = 0; p < data.length; p += 3) {
    const key = ((data[p] >> 4) << 8) | ((data[p + 1] >> 4) << 4) | (data[p + 2] >> 4);
    const e = sums.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += data[p];
    e.g += data[p + 1];
    e.b += data[p + 2];
    sums.set(key, e);
  }

  const total = data.length / 3;
  const scored: Bucket[] = [...sums.values()]
    .map((e) => {
      const r = e.r / e.n;
      const g = e.g / e.n;
      const b = e.b / e.n;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const extreme = max < 40 || min > 225;
      return { r, g, b, n: e.n, score: (e.n / total) * (extreme ? 0.5 : 0.6 + sat * 1.6) };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  // Gold on a black Circe: the most prominent bucket that clearly differs.
  const ink = scored.find(
    (c) =>
      c.n / total >= MIN_INK_SHARE &&
      Math.abs(luminance(c) - luminance(best)) > MIN_INK_LUMINANCE_GAP
  );
  return { color: hex(best), ink: ink ? hex(ink) : null };
}
