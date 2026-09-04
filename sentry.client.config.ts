import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // Whitespace stripped: the value pasted into Vercel carried a line break in
  // the middle of the host, which made the DSN invalid and silently disabled
  // error reporting for months.
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN?.replace(/\s+/g, ""),

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.01,

});

/**
 * Session Replay is ~70 KB of gzipped JavaScript that only 1% of sessions
 * ever use, so it is fetched from Sentry's CDN once the page is idle instead
 * of being bundled into every page load. The sampling rates above still apply
 * when the integration is added; errors thrown before it arrives are reported
 * without a replay.
 */
function loadReplayWhenIdle() {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  const load = () => {
    Sentry.lazyLoadIntegration("replayIntegration")
      .then((replayIntegration) => {
        Sentry.addIntegration(replayIntegration({ maskAllText: true, blockAllMedia: true }));
      })
      .catch(() => {
        // Replay is optional; errors still reach Sentry without it.
      });
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(load, { timeout: 5000 });
  } else {
    window.setTimeout(load, 2000);
  }
}

loadReplayWhenIdle();
