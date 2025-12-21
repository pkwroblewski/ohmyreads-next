import { Resend } from "resend";

// Lazy-initialize Resend client to avoid build-time errors
let resendClient: Resend | null = null;

export function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
}

// Default sender email - update this to your verified domain
export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "OhMyReads <hello@ohmyreads.com>";
