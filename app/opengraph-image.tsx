import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "OhMyReads - Track Your Reading Journey";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #FDF8F3 0%, #F5EDE4 50%, #EDE4D9 100%)",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Decorative book elements */}
        <div
          style={{
            position: "absolute",
            top: "40px",
            left: "40px",
            display: "flex",
            gap: "8px",
            opacity: 0.15,
          }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                width: "30px",
                height: "120px",
                background: "#8B4513",
                borderRadius: "3px",
                transform: `rotate(${(i - 3) * 3}deg)`,
              }}
            />
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            right: "40px",
            display: "flex",
            gap: "8px",
            opacity: 0.15,
          }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                width: "30px",
                height: "120px",
                background: "#8B4513",
                borderRadius: "3px",
                transform: `rotate(${(i - 3) * 3}deg)`,
              }}
            />
          ))}
        </div>

        {/* Logo Icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "120px",
            height: "120px",
            background: "linear-gradient(135deg, #8B4513 0%, #A0522D 100%)",
            borderRadius: "24px",
            marginBottom: "32px",
            boxShadow: "0 8px 32px rgba(139, 69, 19, 0.3)",
          }}
        >
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#2D1F14",
            marginBottom: "16px",
            letterSpacing: "-0.02em",
          }}
        >
          OhMyReads
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            color: "#6B5344",
            marginBottom: "40px",
          }}
        >
          Track Your Reading Journey
        </div>

        {/* Features */}
        <div
          style={{
            display: "flex",
            gap: "48px",
            color: "#8B4513",
            fontSize: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            Discover Books
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" />
            </svg>
            Write Reviews
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Connect with Readers
          </div>
        </div>

        {/* Footer badge */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(139, 69, 19, 0.1)",
            padding: "12px 24px",
            borderRadius: "100px",
            fontSize: 16,
            color: "#8B4513",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M7 7h10" />
            <path d="M7 12h10" />
            <path d="M7 17h10" />
          </svg>
          Free &amp; Independent • Not Amazon-owned
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
