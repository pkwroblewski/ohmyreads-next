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
  "/community",
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
      // Check if profile exists - use maybeSingle() to avoid error when no row exists
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("username, display_name, created_at")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile fetch error:", profileError);
      }

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

        // Check if user should be admin based on ADMIN_EMAILS env var
        const adminEmails = (process.env.ADMIN_EMAILS || "")
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        const isAdmin = user.email
          ? adminEmails.includes(user.email.toLowerCase())
          : false;

        // Try inserting profile with error handling
        try {
          const { error: insertError } = await supabase.from("profiles").insert({
            id: user.id,
            username: username,
            display_name: displayName,
            avatar_url: avatarUrl,
            is_admin: isAdmin,
          });

          // If username taken (unique constraint), append random suffix
          if (insertError?.code === "23505") {
            username = `${username}_${Math.random().toString(36).slice(2, 6)}`;
            const { error: retryError } = await supabase.from("profiles").insert({
              id: user.id,
              username: username,
              display_name: displayName,
              avatar_url: avatarUrl,
              is_admin: isAdmin,
            });
            if (retryError) {
              console.error("Profile insert retry error:", retryError);
              return NextResponse.redirect(`${origin}/login?error=profile_creation_failed`);
            }
          } else if (insertError) {
            console.error("Profile insert error:", insertError);
            return NextResponse.redirect(`${origin}/login?error=profile_creation_failed`);
          }
        } catch (error) {
          console.error("Profile creation exception:", error);
          return NextResponse.redirect(`${origin}/login?error=profile_creation_failed`);
        }

        // Create reading_stats with upsert to handle duplicates
        try {
          const { error: statsError } = await supabase
            .from("reading_stats")
            .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
          if (statsError) {
            console.error("Reading stats upsert error:", statsError);
            // Non-fatal, continue with login
          }
        } catch (error) {
          console.error("Reading stats exception:", error);
          // Non-fatal, continue with login
        }

        // Send welcome email for new user (non-blocking)
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
        // Profile exists - check and update admin status based on ADMIN_EMAILS
        const adminEmails = (process.env.ADMIN_EMAILS || "")
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        const shouldBeAdmin = data.user.email
          ? adminEmails.includes(data.user.email.toLowerCase())
          : false;

        // Update is_admin if it should change (with error handling)
        if (shouldBeAdmin) {
          try {
            const { error: adminError } = await supabase
              .from("profiles")
              .update({ is_admin: true })
              .eq("id", data.user.id);
            if (adminError) {
              console.error("Admin status update error:", adminError);
              // Non-fatal, continue with login
            }
          } catch (error) {
            console.error("Admin status update exception:", error);
            // Non-fatal, continue with login
          }
        }

        // Check if new (created in last 5 minutes) for welcome email
        const createdAt = new Date(profile.created_at);
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

        // Send welcome email if profile was created in the last 5 minutes (non-blocking)
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
