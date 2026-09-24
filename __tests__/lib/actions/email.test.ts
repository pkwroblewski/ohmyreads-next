// @vitest-environment node
/**
 * sendWelcomeEmail (audit Task 11): the profiles INSERT webhook is the only
 * sender, and Supabase retries webhooks, so each send carries a per-user
 * Resend idempotency key.
 */

import { describe, it, expect, vi } from "vitest";

const send = vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null });

vi.mock("@/lib/email/resend", () => ({
  getResendClient: () => ({ emails: { send } }),
  FROM_EMAIL: "OhMyReads <hello@ohmyreads.com>",
}));
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

import { sendWelcomeEmail } from "@/lib/actions/email";

describe("sendWelcomeEmail", () => {
  it("sends with an idempotency key tied to the user", async () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";

    const result = await sendWelcomeEmail({ userId, email: "ada@example.com", username: "ada" });

    expect(result).toEqual({ success: true });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ada@example.com" }),
      { idempotencyKey: `welcome/${userId}` }
    );
  });
});
