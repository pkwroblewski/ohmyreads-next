"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      // Registration succeeding is the normal case and needs no console line;
      // a failure is worth surfacing because it silently removes offline support.
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("SW registration failed:", error);
      });
    }
  }, []);

  return null;
}
