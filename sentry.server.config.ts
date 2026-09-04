import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // Whitespace stripped: the value pasted into Vercel carried a line break in
  // the middle of the host, which made the DSN invalid and silently disabled
  // error reporting for months.
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN?.replace(/\s+/g, ""),

  // Sample 10% of transactions in production (full rate in development).
  // This hook now actually runs — see instrumentation.ts — so a rate of 1 would
  // send a span for every server request.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: process.env.NODE_ENV === 'development',
});
