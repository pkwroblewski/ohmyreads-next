"use server";

import { getResendClient, FROM_EMAIL } from "@/lib/email/resend";
import {
  getWelcomeEmailSubject,
  getWelcomeEmailHtml,
  getWelcomeEmailText,
} from "@/lib/email/templates/welcome";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { sendWelcomeEmailSchema } from "@/lib/validation/email";

interface SendWelcomeEmailParams {
  email: string;
  username: string;
  displayName?: string;
}

export async function sendWelcomeEmail({
  email,
  username,
  displayName,
}: SendWelcomeEmailParams): Promise<{ success: boolean; error?: string }> {
  const resend = getResendClient();

  // Skip if no API key configured
  if (!resend) {
    console.warn("RESEND_API_KEY not configured, skipping welcome email");
    return { success: true };
  }

  try {
    // Validate input with Zod (before the rate limit — its key embeds email;
    // no auth here: legitimately called from signup webhook/callback contexts)
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
      console.error("Failed to send welcome email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Unexpected error sending welcome email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
