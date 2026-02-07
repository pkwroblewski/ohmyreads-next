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
