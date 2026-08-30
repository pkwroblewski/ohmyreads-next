import * as Sentry from "@sentry/nextjs";

// Client-side Sentry initialization. Next.js 16 loads this file automatically
// on the client; it replaces the older `sentry.client.config.ts` entry point,
// which we keep importing here so the SDK options live in one place.
import "./sentry.client.config";

/**
 * Reports App Router navigations to Sentry so client-side transitions are
 * traced rather than appearing as gaps between page loads.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
