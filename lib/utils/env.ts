/**
 * Env values pasted into Vercel carry a stray CR-LF (see the CSRF and Sentry
 * DSN fixes). A secret with a trailing CR never matches its header, and undici
 * rejects a header value that contains one before the request is sent.
 *
 * Takes the value rather than the name so `NEXT_PUBLIC_*` reads stay literal
 * and Next can still inline them.
 */
export function cleanEnv(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/[\r\n]/g, "").trim();
  return cleaned || undefined;
}
