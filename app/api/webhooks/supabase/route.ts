import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeEmail } from "@/lib/actions/email";
import { timingSafeEqual } from "crypto";

/**
 * Timing-safe comparison of two strings to prevent timing attacks
 */
function safeCompare(a: string | null, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (Buffer.byteLength(a) !== Buffer.byteLength(b)) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Verify the webhook is from Supabase using a shared secret
function verifyWebhookSecret(request: NextRequest): boolean {
  const secret = request.headers.get("x-webhook-secret");
  const expectedSecret = process.env.SUPABASE_WEBHOOK_SECRET;

  // Fail closed in production - require secret
  if (!expectedSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("SUPABASE_WEBHOOK_SECRET not configured in production - rejecting request");
      return false;
    }
    console.warn("SUPABASE_WEBHOOK_SECRET not configured (dev mode - allowing)");
    return true;
  }

  return safeCompare(secret, expectedSecret);
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

export async function POST(request: NextRequest) {
  // Verify webhook secret
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload: WebhookPayload = await request.json();

    // Handle new profile creation (welcome email)
    if (
      payload.type === "INSERT" &&
      payload.table === "profiles" &&
      payload.schema === "public"
    ) {
      const profile = payload.record;
      const userId = profile.id as string;
      const username = profile.username as string;
      const displayName = profile.display_name as string | undefined;

      // Get user email from auth.users via admin API (requires service role)
      const supabase = createAdminClient();
      const { data: userData } = await supabase.auth.admin.getUserById(userId);

      if (userData?.user?.email && username) {
        const result = await sendWelcomeEmail({
          email: userData.user.email,
          username,
          displayName,
        });

        if (!result.success) {
          console.error("Failed to send welcome email:", result.error);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
