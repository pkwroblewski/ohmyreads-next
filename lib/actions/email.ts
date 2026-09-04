// NOT a "use server" module. This was previously a server action, which exposed
// it as an unauthenticated POST endpoint: any anonymous caller could send mail
// to an arbitrary recipient from our verified Resend domain. It is only ever
// invoked from trusted server-side contexts (the OAuth callback, the Supabase
// signup webhook, and ensureUserProfile), so it is now a plain server module —
// reachable by our own code, not by the network.
import { getResendClient, FROM_EMAIL } from "@/lib/email/resend";
import {
  getWelcomeEmailSubject,
  getWelcomeEmailHtml,
  getWelcomeEmailText,
} from "@/lib/email/templates/welcome";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { sendWelcomeEmailSchema } from "@/lib/validation/email";
import { logger, reportError } from "@/lib/utils/log";
import type { ActionResult } from "@/types/app";
interface SendWelcomeEmailParams {
  email: string;
  username: string;
  displayName?: string;
}

export async function sendWelcomeEmail({
  email,
  username,
  displayName,
}: SendWelcomeEmailParams): Promise<ActionResult> {
  const resend = getResendClient();

  // Skip if no API key configured
  if (!resend) {
    logger.warn("RESEND_API_KEY not configured, skipping welcome email");
    return { success: true };
  }

  try {
    // Validate input with Zod (before the rate limit — its key embeds email).
    // Callers are trusted server-side contexts; see the module comment above.
    const validationResult = sendWelcomeEmailSchema.safeParse({
      email,
      username,
      displayName,
    });
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }
    const validated = validationResult.data;

    // Rate limit: 5 emails per minute per recipient address
    const { allowed } = await checkRateLimit(
      `email:${validated.email.toLowerCase()}`,
      5,
      60000
    );
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: validated.email,
      subject: getWelcomeEmailSubject(),
      html: getWelcomeEmailHtml({
        username: validated.username,
        displayName: validated.displayName,
      }),
      text: getWelcomeEmailText({
        username: validated.username,
        displayName: validated.displayName,
      }),
    });

    if (error) {
      return { success: false, error: reportError("Failed to send welcome email", error) };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: reportError("Unexpected error sending welcome email", error),
    };
  }
}
