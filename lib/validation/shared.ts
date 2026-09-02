import { z } from "zod";

/**
 * A user-supplied URL that is safe to render as an `href`.
 *
 * Zod's `.url()` only checks that the value parses as a URL, so it accepts
 * `javascript:`, `data:` and `vbscript:` schemes. Those run on the app origin
 * the moment anyone clicks the link, so every URL a user can store must also
 * pass the http(s) scheme check here. Pair with `safeHref()` at render time.
 */
export function httpUrl(message = "Invalid URL") {
  return z
    .string()
    .url(message)
    .regex(/^https?:\/\//i, "Only http(s) URLs are allowed")
    .max(2048, "URL is too long");
}
