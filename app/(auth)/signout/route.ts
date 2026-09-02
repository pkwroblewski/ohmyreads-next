import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side sign-out with a reason for the login page.
 *
 * The (app) layout sends a disabled account here: a layout is a Server
 * Component and cannot clear the session cookies itself, a route handler can.
 * Only known reasons are forwarded, so the URL cannot be used to put
 * arbitrary text on the login page.
 */
const REASONS = new Set(["account_disabled"]);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = new URL("/login", request.url);
  const reason = request.nextUrl.searchParams.get("reason");
  if (reason && REASONS.has(reason)) {
    url.searchParams.set("error", reason);
  }
  return NextResponse.redirect(url);
}
