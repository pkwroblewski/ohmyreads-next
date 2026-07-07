import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResendClient, FROM_EMAIL } from "@/lib/email/resend";
import {
  getWeeklyDigestSubject,
  getWeeklyDigestHtml,
  getWeeklyDigestText,
  type WeeklyDigestProps,
} from "@/lib/email/templates/weekly-digest";
import { logger } from "@/lib/utils/log";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for batch processing

// Vercel Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    // Fail closed: if secret is not configured, reject all requests
    const authHeader = request.headers.get("authorization");
    if (!CRON_SECRET) {
      logger.error("CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Service not configured" },
        { status: 503 }
      );
    }
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resend = getResendClient();
    if (!resend) {
      logger.warn("Resend client not configured, skipping digest emails");
      return NextResponse.json({ message: "Email service not configured" });
    }

    const supabase = createAdminClient();
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get users who have digest enabled and haven't received one in the last 6 days
    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("email_digest_enabled", true)
      .eq("email_digest_frequency", "weekly")
      .or(`last_digest_sent_at.is.null,last_digest_sent_at.lt.${sixDaysAgo.toISOString()}`);

    if (usersError) {
      logger.error("Failed to fetch users for digest", { error: usersError.message });
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ message: "No users to send digests to", sent: 0 });
    }

    let sentCount = 0;
    let errorCount = 0;

    // Process users in batches of 10
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (user) => {
          try {
            // Get user's email from auth
            const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
            if (!authUser?.user?.email) {
              logger.warn("No email for user", { userId: user.id });
              return;
            }

            // Get following IDs first
            const { data: followingData } = await supabase
              .from("follows")
              .select("following_id")
              .eq("follower_id", user.id);

            const followingIds = (followingData || []).map((f) => f.following_id);

            // Gather user's weekly stats
            const [statsResult, booksResult, activityResult, challengeResult] = await Promise.all([
              // Reading stats
              supabase
                .from("reading_stats")
                .select("books_read, pages_read, reviews_count, current_streak")
                .eq("user_id", user.id)
                .single(),

              // Books completed this week
              supabase
                .from("user_books")
                .select("book:books(title, author, cover_url)")
                .eq("user_id", user.id)
                .eq("status", "read")
                .gte("finished_at", oneWeekAgo.toISOString())
                .limit(5),

              // Friend activity (from people they follow)
              followingIds.length > 0
                ? supabase
                    .from("activity_feed")
                    .select("actor:profiles!activity_feed_user_id_profiles_fkey(username), type, book:books(title)")
                    .in("user_id", followingIds)
                    .gte("created_at", oneWeekAgo.toISOString())
                    .limit(5)
                : Promise.resolve({ data: [] }),

              // Active challenge
              supabase
                .from("reading_challenges")
                .select("name, current_value, target_value, end_date")
                .eq("user_id", user.id)
                .eq("status", "active")
                .single(),
            ]);

            const stats = statsResult.data || {
              books_read: 0,
              pages_read: 0,
              reviews_count: 0,
              current_streak: 0,
            };

            const recentBooks = (booksResult.data || []).flatMap((item) =>
              item.book
                ? [
                    {
                      title: item.book.title,
                      author: item.book.author,
                      coverUrl: item.book.cover_url ?? undefined,
                    },
                  ]
                : []
            );

            const friendActivity = (activityResult.data || []).flatMap((item) =>
              item.actor && item.book
                ? [
                    {
                      username: item.actor.username,
                      action: formatActivityType(item.type),
                      bookTitle: item.book.title,
                    },
                  ]
                : []
            );

            const challengeProgress = challengeResult.data
              ? {
                  name: challengeResult.data.name,
                  current: challengeResult.data.current_value,
                  target: challengeResult.data.target_value,
                  daysRemaining: Math.max(
                    0,
                    Math.ceil(
                      (new Date(challengeResult.data.end_date).getTime() - now.getTime()) /
                        (24 * 60 * 60 * 1000)
                    )
                  ),
                }
              : undefined;

            const emailProps: WeeklyDigestProps = {
              username: user.username,
              displayName: user.display_name || undefined,
              stats: {
                booksRead: stats.books_read ?? 0,
                pagesRead: stats.pages_read ?? 0,
                reviewsWritten: stats.reviews_count ?? 0,
                currentStreak: stats.current_streak ?? 0,
              },
              recentBooks,
              friendActivity,
              challengeProgress,
            };

            // Send email
            const { error: sendError } = await resend.emails.send({
              from: FROM_EMAIL,
              to: authUser.user.email,
              subject: getWeeklyDigestSubject(emailProps.stats),
              html: getWeeklyDigestHtml(emailProps),
              text: getWeeklyDigestText(emailProps),
            });

            if (sendError) {
              logger.error("Failed to send digest email", {
                userId: user.id,
                error: sendError.message,
              });
              errorCount++;
              return;
            }

            // Update last_digest_sent_at
            await supabase
              .from("profiles")
              .update({ last_digest_sent_at: now.toISOString() })
              .eq("id", user.id);

            sentCount++;
            logger.info("Sent weekly digest", { userId: user.id });
          } catch (err) {
            logger.error("Error processing digest for user", {
              userId: user.id,
              error: err instanceof Error ? err.message : "Unknown error",
            });
            errorCount++;
          }
        })
      );
    }

    return NextResponse.json({
      message: "Weekly digest processing complete",
      sent: sentCount,
      errors: errorCount,
      total: users.length,
    });
  } catch (error) {
    logger.error("Weekly digest cron error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function formatActivityType(type: string): string {
  switch (type) {
    case "added_book":
      return "added";
    case "finished_book":
      return "finished reading";
    case "started_book":
      return "started reading";
    case "reviewed_book":
      return "reviewed";
    case "rated_book":
      return "rated";
    default:
      return "updated";
  }
}
