import { ImageResponse } from "next/og";
import { BRAND_INK, BRAND_RIBBON, BRAND_WALL, BrandMark, loadGoogleFont } from "@/lib/brand/app-icon";

export const runtime = "edge";

export const alt = "OhMyReads: every book you've read, on one shelf";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const WORDMARK = "OhMyReads";
const LINE = "Every book you've read, on one shelf.";

// Spine colours taken from real catalog covers (the shelf prototype's sample
// reader); width follows page count the same way the shelf does.
const SPINES: { c: string; p: number }[] = [
  { c: "#98a1a8", p: 351 }, { c: "#3a2408", p: 199 }, { c: "#191718", p: 815 },
  { c: "#235c86", p: 492 }, { c: "#ecb649", p: 184 }, { c: "#d80703", p: 264 },
  { c: "#aa9368", p: 608 }, { c: "#faf9f5", p: 528 }, { c: "#781d18", p: 513 },
  { c: "#033956", p: 592 }, { c: "#fefbde", p: 306 }, { c: "#b88b2c", p: 395 },
  { c: "#24477a", p: 480 }, { c: "#7b7a76", p: 479 }, { c: "#cab29c", p: 192 },
  { c: "#03aab5", p: 385 }, { c: "#1a1717", p: 330 },
];
const HEIGHTS = [0.92, 0.84, 0.97, 0.88, 0.8, 0.9, 0.95, 0.86, 0.93, 0.83, 0.89, 0.96, 0.87, 0.91, 0.82, 0.94, 0.9];

export default async function OGImage() {
  const [serif, serifItalic] = await Promise.all([
    loadGoogleFont("Literata", 600, WORDMARK + LINE),
    loadGoogleFont("Literata", 400, LINE, true),
  ]);
  const fonts = [
    ...(serif ? [{ name: "Literata", data: serif, weight: 600 as const, style: "normal" as const }] : []),
    ...(serifItalic ? [{ name: "Literata", data: serifItalic, weight: 400 as const, style: "italic" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BRAND_WALL,
          padding: "64px 72px 0",
          fontFamily: "Literata, Georgia, serif",
          color: BRAND_INK,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <BrandMark size={72} spine={BRAND_INK} ribbon={BRAND_RIBBON} />
            <div style={{ fontSize: 56, fontWeight: 600, letterSpacing: "-0.02em" }}>{WORDMARK}</div>
          </div>
          {/* Two rows: Satori mis-measures upright and italic faces side by side
              on one line, so the italic half gets its own row. */}
          <div style={{ display: "flex", flexDirection: "column", fontSize: 54, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            <div style={{ display: "flex", fontWeight: 600 }}>Every book you&apos;ve read,</div>
            <div style={{ display: "flex", fontStyle: "italic", fontWeight: 400 }}>on one shelf.</div>
          </div>
        </div>

        {/* A shelf of spines on a plank */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 230, paddingLeft: 12 }}>
            {SPINES.map((s, i) => (
              <div
                key={i}
                style={{
                  width: Math.round(18 + s.p / 16),
                  height: Math.round(230 * HEIGHTS[i]),
                  background: s.c,
                  borderRadius: "3px 3px 1px 1px",
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)",
                  display: "flex",
                  ...(i === SPINES.length - 1 ? { transform: "rotate(-6deg)", transformOrigin: "bottom right", marginLeft: 8 } : {}),
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", height: 14, background: "#34363b", marginLeft: -72, marginRight: -72 }} />
          <div style={{ display: "flex", height: 30 }} />
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
