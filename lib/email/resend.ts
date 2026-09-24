import { Resend } from "resend";
import { cleanEnv } from "@/lib/utils/env";

// Lazy-initialize Resend client to avoid build-time errors
let resendClient: Resend | null = null;

export function getResendClient(): Resend | null {
  const apiKey = cleanEnv(process.env.RESEND_API_KEY);
  if (!apiKey) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

// Default sender email - update this to your verified domain
export const FROM_EMAIL = cleanEnv(process.env.RESEND_FROM_EMAIL) || "OhMyReads <hello@ohmyreads.com>";
