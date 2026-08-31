import { createClient } from "@/lib/supabase/server";
import { BADGES, type BadgeDefinition } from "@/lib/data/badges";
import type { UserBadge } from "@/types/database";
import { logError } from "@/lib/utils/log";

// Extended badge with unlock info
export interface UserBadgeWithDefinition {
  badge: BadgeDefinition;
  unlocked: boolean;
  unlockedAt: string | null;
}

// Stats needed for badge calculation
interface BadgeStats {
  booksRead: number;
  pagesRead: number;
  reviewsWritten: number;
  fiveStarReviews: number;
  challengesCompleted: number;
  genreCounts: Record<string, number>;
  accountAgeDays: number;
  booksThisMonth: number;
  booksThisYear: number;
  totalCheckins: number;
  checkinStreak: number;
}

// Get user's unlocked badges from database
export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_badges")
    .select("*")
    .eq("user_id", userId)
    .order("unlocked_at", { ascending: false });

  if (error) {
    logError("Error fetching user badges", error);
    return [];
  }

  return data || [];
}

// Get user's badges with full definitions (for display)
export async function getUserBadgesWithDefinitions(
  userId: string
): Promise<UserBadgeWithDefinition[]> {
  const userBadges = await getUserBadges(userId);
  const unlockedBadgeIds = new Set(userBadges.map((ub) => ub.badge_id));

  return BADGES.map((badge) => {
    const userBadge = userBadges.find((ub) => ub.badge_id === badge.id);
    return {
      badge,
      unlocked: unlockedBadgeIds.has(badge.id),
      unlockedAt: userBadge?.unlocked_at || null,
    };
  });
}

// Get only unlocked badges for a user (for profile display)
export async function getUnlockedBadges(
  userId: string
): Promise<UserBadgeWithDefinition[]> {
  const allBadges = await getUserBadgesWithDefinitions(userId);
  return allBadges.filter((b) => b.unlocked);
}

// Calculate stats needed for badge unlock checks
async function calculateBadgeStats(userId: string): Promise<BadgeStats> {
  const supabase = await createClient();

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const monthStart = new Date(thisYear, thisMonth, 1).toISOString();
  const yearStart = new Date(thisYear, 0, 1).toISOString();

  // Fetch all required data in parallel
  const [
    userBooksResult,
    reviewsResult,
    fiveStarResult,
    challengesResult,
    profileResult,
    checkinStatsResult,
  ] = await Promise.all([
    // User books with book details
    supabase
      .from("user_books")
      .select("status, finished_at, book:books(page_count, genres)")
      .eq("user_id", userId)
      .eq("status", "read"),

    // Total reviews
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),

    // Five star reviews
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("rating", 5),

    // Completed challenges
    supabase
      .from("reading_challenges")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed"),

    // Profile for account age
    supabase.from("profiles").select("created_at").eq("id", userId).single(),

    // Check-in stats
    supabase
      .from("user_checkin_stats")
      .select("total_checkins, current_streak")
      .eq("user_id", userId)
      .single(),
  ]);

  const userBooks = userBooksResult.data || [];

  // Calculate totals
  let totalBooks = 0;
  let totalPages = 0;
  let booksThisMonth = 0;
  let booksThisYear = 0;
  const genreCounts: Record<string, number> = {};

  for (const ub of userBooks) {
    totalBooks++;

    // Get book data (handle array type from Supabase)
    const book = Array.isArray(ub.book) ? ub.book[0] : ub.book;

    if (book?.page_count) {
      totalPages += book.page_count;
    }

    // Count genres
    if (book?.genres) {
      for (const genre of book.genres) {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      }
    }

    // Check if finished this month/year
    if (ub.finished_at) {
      if (ub.finished_at >= monthStart) {
        booksThisMonth++;
      }
      if (ub.finished_at >= yearStart) {
        booksThisYear++;
      }
    }
  }

  // Calculate account age
  let accountAgeDays = 0;
  if (profileResult.data?.created_at) {
    const createdAt = new Date(profileResult.data.created_at);
    accountAgeDays = Math.floor(
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  return {
    booksRead: totalBooks,
    pagesRead: totalPages,
    reviewsWritten: reviewsResult.count || 0,
    fiveStarReviews: fiveStarResult.count || 0,
    challengesCompleted: challengesResult.count || 0,
    genreCounts,
    accountAgeDays,
    booksThisMonth,
    booksThisYear,
    totalCheckins: checkinStatsResult.data?.total_checkins || 0,
    checkinStreak: checkinStatsResult.data?.current_streak || 0,
  };
}

// Check if a badge should be unlocked based on stats
function checkBadgeCriteria(
  badge: BadgeDefinition,
  stats: BadgeStats
): boolean {
  const { criteria } = badge;

  // Special handling for early adopter badge
  if (badge.id === "early-adopter") {
    // Early adopter: joined before a certain date (e.g., first 6 months)
    // We'll consider anyone who joined within the first 180 days as early adopter
    // This is a simplified check - in production, you might use a specific cutoff date
    return stats.accountAgeDays >= 30; // At least 30 days old to qualify
  }

  if (criteria.booksRead !== undefined) {
    return stats.booksRead >= criteria.booksRead;
  }

  if (criteria.pagesRead !== undefined) {
    return stats.pagesRead >= criteria.pagesRead;
  }

  if (criteria.reviewsWritten !== undefined) {
    return stats.reviewsWritten >= criteria.reviewsWritten;
  }

  if (criteria.fiveStarReviews !== undefined) {
    return stats.fiveStarReviews >= criteria.fiveStarReviews;
  }

  if (criteria.challengesCompleted !== undefined) {
    return stats.challengesCompleted >= criteria.challengesCompleted;
  }

  if (criteria.genreBooksRead !== undefined) {
    const { genre, count } = criteria.genreBooksRead;
    return (stats.genreCounts[genre] || 0) >= count;
  }

  if (criteria.accountAgeDays !== undefined) {
    return stats.accountAgeDays >= criteria.accountAgeDays;
  }

  if (criteria.booksInOneMonth !== undefined) {
    return stats.booksThisMonth >= criteria.booksInOneMonth;
  }

  if (criteria.booksInOneYear !== undefined) {
    return stats.booksThisYear >= criteria.booksInOneYear;
  }

  if (criteria.totalCheckins !== undefined) {
    return stats.totalCheckins >= criteria.totalCheckins;
  }

  if (criteria.checkinStreak !== undefined) {
    return stats.checkinStreak >= criteria.checkinStreak;
  }

  return false;
}

// Check and unlock any new badges for a user
export async function checkAndUnlockBadges(userId: string): Promise<string[]> {
  const supabase = await createClient();

  // Get current badges and stats
  const [existingBadges, stats] = await Promise.all([
    getUserBadges(userId),
    calculateBadgeStats(userId),
  ]);

  const existingBadgeIds = new Set(existingBadges.map((b) => b.badge_id));

  // Every badge whose criteria are newly met
  const toUnlock = BADGES.filter(
    (badge) => !existingBadgeIds.has(badge.id) && checkBadgeCriteria(badge, stats)
  );

  if (toUnlock.length === 0) return [];

  // One statement instead of a round trip per badge. upsert with
  // ignoreDuplicates keeps the previous forgiving behaviour: a badge already
  // inserted by a concurrent call is skipped rather than failing the batch on
  // the user_badges(user_id, badge_id) unique constraint, and the returned
  // rows are exactly the ones this call actually unlocked.
  const { data, error } = await supabase
    .from("user_badges")
    .upsert(
      toUnlock.map((badge) => ({ user_id: userId, badge_id: badge.id })),
      { onConflict: "user_id,badge_id", ignoreDuplicates: true }
    )
    .select("badge_id");

  if (error) {
    logError("Error unlocking badges", error);
    return [];
  }

  return (data || []).map((row) => row.badge_id);
}

// Get badge unlock progress for a user (for showing how close they are)
export async function getBadgeProgress(
  userId: string
): Promise<
  Array<{ badge: BadgeDefinition; progress: number; current: number; target: number }>
> {
  const stats = await calculateBadgeStats(userId);
  const userBadges = await getUserBadges(userId);
  const unlockedIds = new Set(userBadges.map((b) => b.badge_id));

  const progressList: Array<{
    badge: BadgeDefinition;
    progress: number;
    current: number;
    target: number;
  }> = [];

  for (const badge of BADGES) {
    // Skip already unlocked
    if (unlockedIds.has(badge.id)) continue;

    const { criteria } = badge;
    let current = 0;
    let target = 0;

    if (criteria.booksRead !== undefined) {
      current = stats.booksRead;
      target = criteria.booksRead;
    } else if (criteria.pagesRead !== undefined) {
      current = stats.pagesRead;
      target = criteria.pagesRead;
    } else if (criteria.reviewsWritten !== undefined) {
      current = stats.reviewsWritten;
      target = criteria.reviewsWritten;
    } else if (criteria.fiveStarReviews !== undefined) {
      current = stats.fiveStarReviews;
      target = criteria.fiveStarReviews;
    } else if (criteria.challengesCompleted !== undefined) {
      current = stats.challengesCompleted;
      target = criteria.challengesCompleted;
    } else if (criteria.genreBooksRead !== undefined) {
      current = stats.genreCounts[criteria.genreBooksRead.genre] || 0;
      target = criteria.genreBooksRead.count;
    } else if (criteria.booksInOneYear !== undefined) {
      current = stats.booksThisYear;
      target = criteria.booksInOneYear;
    } else if (criteria.booksInOneMonth !== undefined) {
      current = stats.booksThisMonth;
      target = criteria.booksInOneMonth;
    } else if (criteria.accountAgeDays !== undefined) {
      current = stats.accountAgeDays;
      target = criteria.accountAgeDays;
    } else if (criteria.totalCheckins !== undefined) {
      current = stats.totalCheckins;
      target = criteria.totalCheckins;
    } else if (criteria.checkinStreak !== undefined) {
      current = stats.checkinStreak;
      target = criteria.checkinStreak;
    }

    if (target > 0) {
      progressList.push({
        badge,
        progress: Math.min(100, Math.round((current / target) * 100)),
        current,
        target,
      });
    }
  }

  // Sort by progress (closest to unlocking first)
  return progressList.sort((a, b) => b.progress - a.progress);
}
