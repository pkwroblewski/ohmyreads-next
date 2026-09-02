/**
 * The only remote hosts this app will load images from.
 *
 * One list feeds two consumers: `images.remotePatterns` in `next.config.ts`
 * (what `next/image` may optimise) and `isAllowedImageHost()` below (what the
 * OG image routes may fetch server-side). Keeping them in one place means a
 * cover or avatar URL that the browser would refuse cannot be turned into a
 * server-side request either — the OG routes run `<img src>` through
 * `@vercel/og`, which fetches the URL from our infrastructure, so an
 * unchecked `avatar_url` of `http://169.254.169.254/...` would be an SSRF.
 *
 * Pure module: it is imported from an edge route, so no Node-only imports.
 */

export interface AllowedImageHost {
  protocol: "https";
  hostname: string;
  pathname?: string;
}

export const ALLOWED_IMAGE_HOSTS: AllowedImageHost[] = [
  { protocol: "https", hostname: "covers.openlibrary.org", pathname: "/b/**" },
  { protocol: "https", hostname: "books.google.com", pathname: "/books/**" },
  { protocol: "https", hostname: "*.googleusercontent.com" },
  { protocol: "https", hostname: "archive.org", pathname: "/download/**" },
  { protocol: "https", hostname: "*.us.archive.org", pathname: "/**" },
];

/**
 * Same wildcard semantics as Next.js `remotePatterns`: `*` matches one
 * hostname label, `**` matches any number.
 */
function hostnameMatches(pattern: string, hostname: string): boolean {
  const want = pattern.toLowerCase().split(".");
  const have = hostname.toLowerCase().split(".");

  // `**` is only meaningful as the leading label ("**.example.com").
  if (want[0] === "**") {
    const rest = want.slice(1);
    return (
      have.length > rest.length &&
      rest.every((label, i) => label === have[have.length - rest.length + i])
    );
  }

  return (
    want.length === have.length &&
    want.every((label, i) => label === "*" || label === have[i])
  );
}

/**
 * True when `url` is an absolute https URL on one of the allowed hosts.
 * Anything else — a relative path, http, an IP literal, a metadata endpoint,
 * a malformed string — is refused, and the caller should render a placeholder.
 */
export function isAllowedImageHost(
  url: string | null | undefined
): url is string {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return ALLOWED_IMAGE_HOSTS.some((host) =>
    hostnameMatches(host.hostname, parsed.hostname)
  );
}
