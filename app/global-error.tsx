"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            fontFamily: "system-ui, sans-serif",
            backgroundColor: "#FFFBF5",
            color: "#2C2416",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <div
              style={{
                marginBottom: "1.5rem",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <AlertTriangle
                style={{ width: "48px", height: "48px", color: "#DC2626" }}
              />
            </div>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                marginBottom: "0.5rem",
              }}
            >
              Critical Error
            </h1>
            <p style={{ color: "#8B7D6B", marginBottom: "1.5rem" }}>
              Something went seriously wrong. Please refresh the page.
            </p>
            <button
              onClick={reset}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#8B4513",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

