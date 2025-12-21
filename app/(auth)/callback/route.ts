import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/actions/email";

// Whitelist of allowed redirect paths to prevent open redirect attacks
const ALLOWED_REDIRECTS = [
  "/dashboard",
  "/my-shelf",
  "/profile",
  "/settings",
  "/stats",
  "/challenges",
  "/onboarding",
  "/books",
  "/submit-book",
  "/my-submissions",
  "/admin",
  "/reset-password",
  "/import",
];

function isValidRedirect(path: string): boolean {
  return ALLOWED_REDIRECTS.some(
    (allowed) => path === allowed || path.startsWith(`${allowed}/`)
  );
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectParam = searchParams.get("redirect") || "/dashboard";

  // Validate redirect to prevent open redirect attacks
  const redirect = isValidRedirect(redirectParam) ? redirectParam : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if this is a new user (profile created in last 5 minutes)
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name, created_at")
        .eq("id", data.user.id)
        .single();

      if (profile) {
        const createdAt = new Date(profile.created_at);
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

        // Send welcome email if profile was created in the last 5 minutes
        if (createdAt > fiveMinutesAgo && data.user.email) {
          // Fire and forget - don't block redirect
          sendWelcomeEmail({
            email: data.user.email,
            username: profile.username,
            displayName: profile.display_name || undefined,
          }).catch((err) => {
            console.error("Failed to send welcome email:", err);
          });
        }
      }

      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  // If error or no code, redirect to login with error parameter
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
