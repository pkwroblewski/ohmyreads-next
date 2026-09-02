import { createHmac } from "crypto";
import { safeCompare } from "@/lib/utils/secrets";

/**
 * Signed one-click unsubscribe links for the weekly digest.
 *
 * The link must work without a session (RFC 8058 one-click, and people click
 * it from a mail client), so the proof that it was *sent to this user* is an
 * HMAC of the user id under a server secret. Nothing else is in the token: it
 * does not expire, and it only ever grants "turn my digest off".
 *
 * Secret: `EMAIL_TOKEN_SECRET`, falling back to `CRON_SECRET` (which the digest
 * cron already requires) so no new variable is mandatory.
 */
export function getEmailTokenSecret(): string | null {
  return process.env.EMAIL_TOKEN_SECRET || process.env.CRON_SECRET || null;
}

export function signUnsubscribeToken(userId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`unsubscribe:digest:${userId}`)
    .digest("base64url");
}

export function verifyUnsubscribeToken(
  userId: string,
  token: string | null | undefined,
  secret: string
): boolean {
  return safeCompare(token, signUnsubscribeToken(userId, secret));
}

export function buildUnsubscribeUrl(
  userId: string,
  secret: string,
  siteUrl: string
): string {
  const url = new URL("/api/email/unsubscribe", siteUrl);
  url.searchParams.set("u", userId);
  url.searchParams.set("t", signUnsubscribeToken(userId, secret));
  return url.toString();
}
