import type { NextConfig } from "next";
import { ALLOWED_IMAGE_HOSTS } from "./lib/config/image-hosts";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    // Covers and the hero never change under the same URL; keep optimizer output for 30 days
    minimumCacheTTL: 2592000,
    qualities: [75, 85, 90],
    remotePatterns: ALLOWED_IMAGE_HOSTS,
  },

  // Security headers
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: [
          // Prevent clickjacking by disallowing embedding in iframes
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Prevent MIME type sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Control referrer information sent with requests
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Disable sensitive browser APIs we don't use (geolocation allowed for own origin)
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
          },
          // Prevent XSS attacks (modern browsers)
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // Enforce HTTPS
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // Content Security Policy
          // Explicit domains prevent data exfiltration to arbitrary third parties.
          // wss: for Supabase is required - Firefox enforces CSP strictly.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // 'unsafe-inline' needed for Next.js inline scripts; 'unsafe-eval' removed
              "script-src 'self' 'unsafe-inline' https://vercel.live https://*.sentry.io https://browser.sentry-cdn.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://covers.openlibrary.org https://books.google.com https://*.googleusercontent.com https://*.supabase.co https://archive.org https://*.us.archive.org",
              "font-src 'self' https://fonts.gstatic.com data:",
              // Explicit domains for API connections and WebSockets
              "connect-src 'self' " +
                "https://*.supabase.co wss://*.supabase.co " + // Supabase API + realtime
                "https://api.mapbox.com https://*.mapbox.com " + // Mapbox services
                "https://events.mapbox.com " + // Mapbox telemetry
                "https://openlibrary.org https://covers.openlibrary.org " + // OpenLibrary
                "https://www.googleapis.com https://books.google.com " + // Google Books
                "https://*.sentry.io https://*.ingest.sentry.io " + // Sentry
                "https://vercel.live wss://ws-us3.pusher.com", // Vercel Live (dev)
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Webpack-specific options
  webpack: {
    // Automatically tree-shake Sentry logger statements to reduce bundle size
    treeshake: {
      removeDebugLogging: true,
    },

    // Enables automatic instrumentation of Vercel Cron Monitors
    automaticVercelMonitors: true,
  },

  // Hides source maps from generated client bundles
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
