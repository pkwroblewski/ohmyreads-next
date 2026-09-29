// Builds books.json for the shelf prototype: a sample reader picked from the
// catalog export (raw.json), with a spine colour and a small cover thumbnail
// taken from each real cover. Run from the repo root:
//   node .claude/prototypes/shelf/build-data.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const raw = JSON.parse(fs.readFileSync(path.join(dir, "raw.json"), "utf8"));
const catalog = JSON.parse((raw.rows || raw)[0].j);

// Deterministic PRNG so the shelf is the same on every run.
let seed = 20260929;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const quotas = {
  Fantasy: 12, "Science Fiction": 12, Classics: 10, "Literary Fiction": 8,
  "Young Adult": 6, Horror: 4, Thriller: 4, Crime: 3, Mystery: 3,
  "Historical Fiction": 3, Romance: 3, Dystopian: 3, Poetry: 2,
  "Short Stories": 2, Biography: 2, Memoir: 2, History: 2, Psychology: 2,
  "Non-Fiction": 2, "Graphic Novel": 2, Humor: 2,
};
const skip = /box set|collection|boxed|omnibus|complete works|\bset\b/i;

const perAuthor = new Map();
const seenTitle = new Set();
const picked = [];
const rest = [];
for (const b of catalog) {
  const g = (b.genres || [])[0];
  const key = b.title.toLowerCase().replace(/[^a-z]/g, "");
  if (skip.test(b.title) || seenTitle.has(key)) continue;
  if ((perAuthor.get(b.author) || 0) >= 2) { rest.push(b); continue; }
  if (g && quotas[g] > 0 && rand() < 0.8) {
    quotas[g]--;
    seenTitle.add(key);
    perAuthor.set(b.author, (perAuthor.get(b.author) || 0) + 1);
    picked.push({ ...b, genre: g });
  } else rest.push(b);
}

// Shuffle, then spread across 2024, 2025 and 2026 (up to late September).
for (let i = picked.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [picked[i], picked[j]] = [picked[j], picked[i]];
}
const plan = [["2024", 31, 12], ["2025", 36, 12], ["2026", picked.length - 1 - 67, 9]];
let k = 0;
const read = [];
for (const [year, n, months] of plan) {
  const dates = Array.from({ length: n }, () => {
    const m = 1 + Math.floor(rand() * months);
    const d = 1 + Math.floor(rand() * 27);
    return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }).sort();
  for (const date of dates) read.push({ ...picked[k++], finished: date, status: "read" });
}
const current = { ...picked[k], status: "reading", progress: 0.62 };
const wantToRead = rest
  .filter((b) => !seenTitle.has(b.title.toLowerCase().replace(/[^a-z]/g, "")) && !skip.test(b.title))
  .filter(() => rand() < 0.2)
  .slice(0, 8)
  .map((b) => ({ ...b, genre: (b.genres || [])[0] || "Fiction", status: "want" }));

async function withCover(b) {
  const out = {
    title: b.title, author: b.author, slug: b.slug, pages: b.page_count,
    genre: b.genre, year: b.year, status: b.status,
    finished: b.finished || null, progress: b.progress || null,
  };
  try {
    const res = await fetch(b.cover_url);
    if (!res.ok) throw new Error(String(res.status));
    const buf = Buffer.from(await res.arrayBuffer());
    // Colour from the cover's left third, where a real jacket wraps onto the spine.
    // Bucket the pixels and favour saturated buckets, so a cover with black
    // lettering on a green jacket gives a green spine. Near-black or
    // near-white only wins when the cover really is mostly that.
    const meta = await sharp(buf).metadata();
    const { data } = await sharp(buf)
      .extract({ left: 0, top: 0, width: Math.max(1, Math.floor(meta.width / 3)), height: meta.height })
      .resize(24, 72, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const buckets = new Map();
    for (let p = 0; p < data.length; p += 3) {
      const key = ((data[p] >> 4) << 8) | ((data[p + 1] >> 4) << 4) | (data[p + 2] >> 4);
      const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += data[p]; e.g += data[p + 1]; e.b += data[p + 2];
      buckets.set(key, e);
    }
    const total = data.length / 3;
    const scored = [...buckets.values()].map((e) => {
      const r = e.r / e.n, g = e.g / e.n, bl = e.b / e.n;
      const max = Math.max(r, g, bl), min = Math.min(r, g, bl);
      const sat = max === 0 ? 0 : (max - min) / max;
      const extreme = max < 40 || min > 225;
      return { r, g, b: bl, sat, n: e.n, score: (e.n / total) * (extreme ? 0.5 : 0.6 + sat * 1.6) };
    }).sort((a, b) => b.score - a.score);
    const best = scored[0];
    const rgb = (c) => `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;
    out.color = rgb(best);
    // Lettering colour: the most prominent bucket that clearly differs from
    // the spine (gold on a black Circe), if one covers at least 2 % of the strip.
    const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const ink = scored.find((c) => c.n / total >= 0.02 && Math.abs(lum(c) - lum(best)) > 90);
    out.ink = ink ? rgb(ink) : null;
    const thumb = await sharp(buf).resize({ width: 180 }).webp({ quality: 62 }).toBuffer();
    out.cover = `data:image/webp;base64,${thumb.toString("base64")}`;
  } catch (e) {
    out.color = null; // the page falls back to a genre colour
    out.cover = null;
    console.warn("no cover:", b.title, e.message);
  }
  return out;
}

const all = [...read, current, ...wantToRead];
const books = [];
for (let i = 0; i < all.length; i += 8) {
  books.push(...(await Promise.all(all.slice(i, i + 8).map(withCover))));
}
fs.writeFileSync(path.join(dir, "books.json"), JSON.stringify(books));
console.log(
  `read ${read.length}, reading 1, want ${wantToRead.length}; ` +
  `${books.filter((b) => !b.cover).length} without cover; ` +
  `${(fs.statSync(path.join(dir, "books.json")).size / 1024).toFixed(0)} KB`
);
