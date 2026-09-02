import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getEmailTokenSecret,
  verifyUnsubscribeToken,
} from "@/lib/email/unsubscribe-token";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { logError, logger } from "@/lib/utils/log";

export const runtime = "nodejs";

/**
 * One-click digest unsubscribe: `GET|POST /api/email/unsubscribe?u=<id>&t=<sig>`.
 *
 * No session: the link is opened from a mail client, and mail providers POST
 * to it themselves (RFC 8058 `List-Unsubscribe-Post`). Authority comes from
 * the HMAC in `t`, verified in constant time; the only thing it can do is set
 * `email_digest_enabled = false` for that one user, through the service-role
 * client because the email columns are not readable by the API roles (065).
 */
const paramsSchema = z.object({
  u: z.string().uuid(),
  t: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ohmyreads.com";

function page(title: string, body: string, status: number): NextResponse {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${title} · OhMyReads</title>
  <style>
    body { margin: 0; padding: 48px 16px; font-family: Georgia, serif; background: #FAF7F2; color: #3D2B1F; }
    main { max-width: 440px; margin: 0 auto; background: #fff; border: 1px solid #E8DFD3; border-radius: 12px; padding: 32px; text-align: center; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p { margin: 0 0 20px; line-height: 1.5; color: #6B5744; }
    a { color: #8B5A2B; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${body}</p>
    <p><a href="${SITE_URL}/settings">Manage email preferences</a></p>
  </main>
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function unsubscribe(request: NextRequest): Promise<NextResponse> {
  try {
    const ip = getClientIp(request);
    const { allowed } = await checkRateLimit(`email-unsubscribe:${ip}`, 10, 60000);
    if (!allowed) {
      return page("Too many requests", "Please try the link again in a minute.", 429);
    }

    const secret = getEmailTokenSecret();
    if (!secret) {
      logger.error("Unsubscribe: EMAIL_TOKEN_SECRET / CRON_SECRET not configured");
      return page(
        "Not available",
        "Unsubscribe links are not configured on this server yet.",
        503
      );
    }

    const parsed = paramsSchema.safeParse({
      u: request.nextUrl.searchParams.get("u"),
      t: request.nextUrl.searchParams.get("t"),
    });
    if (!parsed.success || !verifyUnsubscribeToken(parsed.data.u, parsed.data.t, secret)) {
      return page(
        "This link is not valid",
        "It may have been copied incompletely. You can still turn the digest off from your settings.",
        400
      );
    }

    const supabase = createAdminClient();
    const { data: rows, error } = await supabase
      .from("profiles")
      .update({ email_digest_enabled: false })
      .eq("id", parsed.data.u)
      .select("id");

    if (error) {
      logError("Unsubscribe: update failed", error, { userId: parsed.data.u });
      return page("Something went wrong", "Please try again later.", 500);
    }
    if (!rows || rows.length === 0) {
      logger.warn("Unsubscribe: no such profile", { userId: parsed.data.u });
      return page(
        "This link is not valid",
        "We could not find that account. You can still turn the digest off from your settings.",
        400
      );
    }

    return page(
      "You're unsubscribed",
      "You will no longer receive the weekly reading digest.",
      200
    );
  } catch (error) {
    logError("Unsubscribe: unexpected error", error);
    return page("Something went wrong", "Please try again later.", 500);
  }
}

export async function GET(request: NextRequest) {
  return unsubscribe(request);
}

/** RFC 8058 one-click: mail providers POST `List-Unsubscribe=One-Click`. */
export async function POST(request: NextRequest) {
  return unsubscribe(request);
}
