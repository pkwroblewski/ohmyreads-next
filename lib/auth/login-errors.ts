/**
 * The `?error=` codes the app sends people to /login with, and what to tell
 * them. Anything not listed here renders nothing: the query string is
 * attacker-controlled, so it is a lookup key, never text.
 *
 * Senders: app/(app)/layout.tsx (auth_error, profile_creation_failed,
 * layout_error, account_disabled via /signout), app/(auth)/callback/route.ts
 * (profile_creation_failed, auth_failed).
 */
export const LOGIN_ERROR_MESSAGES = {
  auth_error: "Your session expired. Please sign in again.",
  auth_failed: "We could not complete the sign-in. Please try again.",
  profile_creation_failed:
    "We could not finish setting up your profile. Please sign in again; if this keeps happening, contact support@ohmyreads.com.",
  layout_error: "Something went wrong loading your account. Please sign in again.",
  account_disabled:
    "This account has been disabled. If you think this is a mistake, contact support@ohmyreads.com.",
} as const;

export type LoginErrorCode = keyof typeof LOGIN_ERROR_MESSAGES;

/** The message for a code from the URL, or null for anything unknown. */
export function loginErrorMessage(code: string | null): string | null {
  if (!code || !Object.hasOwn(LOGIN_ERROR_MESSAGES, code)) return null;
  return LOGIN_ERROR_MESSAGES[code as LoginErrorCode];
}
