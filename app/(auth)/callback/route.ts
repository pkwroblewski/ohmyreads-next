import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/actions/email";
import { logger, extractErrorInfo, extractSupabaseErrorInfo } from "@/lib/utils/log";
import type { Database } from "@/types/database";

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

  // New users get routed to taste onboarding — but never when the user
  // explicitly asked for a destination (e.g. ?redirect=/import from a CTA)
  let destination = redirect;
  const isDefaultRedirect = redirect === "/dashboard";

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
        logger.error("Profile fetch error", extractSupabaseErrorInfo(profileError));
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
        // This is ONLY for initial provisioning of new users
        const adminEmails = (process.env.ADMIN_EMAILS || "")
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        const isAdmin = user.email
          ? adminEmails.includes(user.email.toLowerCase())
          : false;

        // Try inserting profile with error handling
        try {
          const profileData: Database["public"]["Tables"]["profiles"]["Insert"] = {
            id: user.id,
            username: username,
            display_name: displayName,
            avatar_url: avatarUrl,
            is_admin: isAdmin,
          };

          // If granting admin, record when it was granted
          if (isAdmin) {
            profileData.admin_granted_at = new Date().toISOString();
            // admin_granted_by is NULL for env var provisioning
          }

          const { error: insertError } = await supabase.from("profiles").insert(profileData);

          // If username taken (unique constraint), append random suffix
          if (insertError?.code === "23505") {
            username = `${username}_${Math.random().toString(36).slice(2, 6)}`;
            profileData.username = username;
            const { error: retryError } = await supabase.from("profiles").insert(profileData);
            if (retryError) {
              logger.error("Profile insert retry error", extractSupabaseErrorInfo(retryError));
              return NextResponse.redirect(`${origin}/login?error=profile_creation_failed`);
            }
          } else if (insertError) {
            logger.error("Profile insert error", extractSupabaseErrorInfo(insertError));
            return NextResponse.redirect(`${origin}/login?error=profile_creation_failed`);
          }

          // Log admin role grant in audit table (if admin was granted)
          if (isAdmin) {
            try {
              await supabase.from("admin_role_changes").insert({
                user_id: user.id,
                changed_by: null, // System/env var provisioning
                action: "granted",
                source: "env_initial",
                reason: "Initial admin provisioning from ADMIN_EMAILS environment variable",
              });
            } catch (auditError) {
              logger.error("Admin audit log error", extractErrorInfo(auditError));
              // Non-fatal, continue
            }
          }
        } catch (error) {
          logger.error("Profile creation exception", extractErrorInfo(error));
          return NextResponse.redirect(`${origin}/login?error=profile_creation_failed`);
        }

        // Create reading_stats with upsert to handle duplicates
        try {
          const { error: statsError } = await supabase
            .from("reading_stats")
            .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
          if (statsError) {
            logger.error("Reading stats upsert error", extractSupabaseErrorInfo(statsError));
            // Non-fatal, continue with login
          }
        } catch (error) {
          logger.error("Reading stats exception", extractErrorInfo(error));
          // Non-fatal, continue with login
        }

        // Send welcome email for new user (non-blocking)
        if (user.email) {
          sendWelcomeEmail({
            email: user.email,
            username: username,
            displayName: displayName || undefined,
          }).catch((err) => {
            logger.error("Failed to send welcome email", extractErrorInfo(err));
          });
        }

        // Brand-new profile → route into taste onboarding
        if (isDefaultRedirect) {
          destination = "/onboarding/taste";
        }
      } else {
        // Profile exists - admin status is now managed via database only
        // We no longer update admin status on every login based on ADMIN_EMAILS
        // Admins are granted/revoked through the admin panel with full audit trail

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
            logger.error("Failed to send welcome email", extractErrorInfo(err));
          });
        }

        // Recent account that hasn't completed taste onboarding → route there
        // (same new-account window as the welcome email; older accounts skip)
        if (createdAt > fiveMinutesAgo && isDefaultRedirect) {
          const { data: taste } = await supabase
            .from("user_taste_profiles")
            .select("onboarding_completed")
            .eq("user_id", data.user.id)
            .maybeSingle();

          if (!taste?.onboarding_completed) {
            destination = "/onboarding/taste";
          }
        }
      }

      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  // If error or no code, redirect to login with error parameter
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
