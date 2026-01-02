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
      // Check if profile exists
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name, created_at")
        .eq("id", data.user.id)
        .single();

      if (!profile) {
        // CREATE PROFILE IF MISSING (fallback for failed trigger)
        // This handles Google OAuth where trigger may fail due to metadata differences
        const user = data.user;
        const metadata = user.user_metadata || {};

        // Generate username from email or metadata
        let username =
          metadata.preferred_username ||
          metadata.user_name ||
          user.email?.split("@")[0] ||
          `user_${user.id.slice(0, 8)}`;

        // Get display name from various OAuth provider fields
        const displayName =
          metadata.full_name ||
          metadata.name ||
          metadata.display_name ||
          null;

        // Get avatar - Google uses 'picture', others use 'avatar_url'
        const avatarUrl =
          metadata.picture ||
          metadata.avatar_url ||
          null;

        // Try inserting profile
        const { error: insertError } = await supabase.from("profiles").insert({
          id: user.id,
          username: username,
          display_name: displayName,
          avatar_url: avatarUrl,
        });

        // If username taken (unique constraint), append random suffix
        if (insertError?.code === "23505") {
          username = `${username}_${Math.random().toString(36).slice(2, 6)}`;
          await supabase.from("profiles").insert({
            id: user.id,
            username: username,
            display_name: displayName,
            avatar_url: avatarUrl,
          });
        }

        // Also create reading_stats
        await supabase.from("reading_stats").insert({
          user_id: user.id,
        });

        // Send welcome email for new user
        if (user.email) {
          sendWelcomeEmail({
            email: user.email,
            username: username,
            displayName: displayName || undefined,
          }).catch((err) => {
            console.error("Failed to send welcome email:", err);
          });
        }
      } else {
        // Profile exists - check if new (created in last 5 minutes)
        const createdAt = new Date(profile.created_at);
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

        // Send welcome email if profile was created in the last 5 minutes
        if (createdAt > fiveMinutesAgo && data.user.email) {
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
