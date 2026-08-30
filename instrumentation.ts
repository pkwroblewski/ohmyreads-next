import * as Sentry from "@sentry/nextjs";

/**
 * Next.js instrumentation hook.
 *
 * Without this file, `sentry.server.config.ts` and `sentry.edge.config.ts` are
 * never loaded: Next only evaluates them via `register()`. That left the entire
 * server-side error surface — every server action in `lib/actions/*` and every
 * route handler in `app/api/*` — reporting to nothing in production.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Captures errors thrown in Server Components, route handlers, and server
 * actions. Next calls this hook on every request-scoped error; without it those
 * errors never reach Sentry even when the SDK is initialized.
 */
export const onRequestError = Sentry.captureRequestError;
