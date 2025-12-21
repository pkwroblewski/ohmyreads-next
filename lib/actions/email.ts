"use server";

import { getResendClient, FROM_EMAIL } from "@/lib/email/resend";
import {
  getWelcomeEmailSubject,
  getWelcomeEmailHtml,
  getWelcomeEmailText,
} from "@/lib/email/templates/welcome";

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
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: getWelcomeEmailSubject(),
      html: getWelcomeEmailHtml({ username, displayName }),
      text: getWelcomeEmailText({ username, displayName }),
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
