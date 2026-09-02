/**
 * CSRF protection for API routes via Origin header validation.
 * Server Actions have built-in CSRF protection; this covers raw API routes.
 */

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL,
  // Allow localhost in development
  ...(process.env.NODE_ENV === 'development'
    ? ['http://localhost:3000', 'http://127.0.0.1:3000']
    : []),
].filter(Boolean) as string[];

/**
 * Validate that a request originates from an allowed origin.
 * Returns true if the origin is valid, false otherwise.
 */
export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // If no origin header (same-origin requests in some browsers), check referer
  const source = origin || (referer ? new URL(referer).origin : null);

  if (!source) {
    // No origin or referer — could be server-to-server or same-origin
    // In production, reject requests without origin for mutation endpoints
    return process.env.NODE_ENV !== 'production';
  }

  return ALLOWED_ORIGINS.some((allowed) => source === allowed);
}

/**
 * Detect cross-site requests to public GET endpoints.
 * Returns true when an Origin (or, failing that, Referer) header is present
 * AND its host differs from the request's own host and all allowed origins.
 *
 * When neither header is present the browser-set `Sec-Fetch-Site` header
 * decides: `same-origin` and `none` (typed URL, bookmark) are allowed, anything
 * else is foreign. A cross-site `<img src=/api/geo/...>` or a `no-referrer`
 * page sends no Origin/Referer but still sends `Sec-Fetch-Site: cross-site`,
 * so this closes the gap the header check alone left open. Requests with no
 * fetch metadata at all (curl, server-to-server, old bots) are refused too —
 * these endpoints spend paid API budget and only the site's own pages should
 * drive them.
 */
export function isForeignOrigin(request: Request): boolean {
  const source =
    request.headers.get("origin") ?? request.headers.get("referer");
  if (!source) {
    const site = request.headers.get("sec-fetch-site");
    return site !== "same-origin" && site !== "none";
  }

  let sourceHost: string;
  try {
    sourceHost = new URL(source).host;
  } catch {
    // Malformed header (e.g. "Origin: null" from sandboxed iframes) — foreign
    return true;
  }

  const allowedHosts = new Set([new URL(request.url).host]);
  for (const origin of ALLOWED_ORIGINS) {
    try {
      allowedHosts.add(new URL(origin.trim()).host);
    } catch {
      // Skip malformed configured origins
    }
  }

  return !allowedHosts.has(sourceHost);
}
