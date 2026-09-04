// Achievement Badge Definitions
// Badges are unlocked based on reading activity and engagement

export type BadgeCategory =
  | "reading"
  | "pages"
  | "reviews"
  | "streaks"
  | "genres"
  | "checkins"
  | "special";

export type BadgeTier = "bronze" | "silver" | "gold" | "platinum";

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  category: BadgeCategory;
  tier: BadgeTier;
  // Unlock criteria - at least one must be defined
  criteria: {
    booksRead?: number;
    pagesRead?: number;
    reviewsWritten?: number;
    fiveStarReviews?: number;
    challengesCompleted?: number;
    genreBooksRead?: { genre: string; count: number };
    accountAgeDays?: number;
    booksInOneMonth?: number;
    booksInOneYear?: number;
    totalCheckins?: number;
    checkinStreak?: number;
  };
}

// Tier colors for UI
export const TIER_COLORS: Record<BadgeTier, { bg: string; text: string; border: string }> = {
  bronze: {
    bg: "from-amber-600 to-orange-700",
    text: "text-amber-100",
    border: "border-amber-500/30",
  },
  silver: {
    bg: "from-slate-400 to-slate-500",
    text: "text-slate-100",
    border: "border-slate-400/30",
  },
  gold: {
    bg: "from-yellow-400 to-amber-500",
    text: "text-yellow-900",
    border: "border-yellow-400/30",
  },
  platinum: {
    bg: "from-indigo-400 to-purple-500",
    text: "text-white",
    border: "border-purple-400/30",
  },
};

// Category labels and icons
export const CATEGORY_INFO: Record<BadgeCategory, { label: string; icon: string }> = {
  reading: { label: "Reading", icon: "📚" },
  pages: { label: "Pages", icon: "📖" },
  reviews: { label: "Reviews", icon: "✍️" },
  streaks: { label: "Dedication", icon: "🔥" },
  genres: { label: "Genres", icon: "🎭" },
  checkins: { label: "Check-ins", icon: "📍" },
  special: { label: "Special", icon: "⭐" },
};

// All badge definitions
export const BADGES: BadgeDefinition[] = [
  // ========================================
  // READING BADGES (Books Read)
  // ========================================
  {
    id: "first-book",
    name: "First Steps",
    description: "Read your first book",
    icon: "🌱",
    category: "reading",
    tier: "bronze",
    criteria: { booksRead: 1 },
  },
  {
    id: "bookworm",
    name: "Bookworm",
    description: "Read 10 books",
    icon: "🐛",
    category: "reading",
    tier: "bronze",
    criteria: { booksRead: 10 },
  },
  {
    id: "avid-reader",
    name: "Avid Reader",
    description: "Read 25 books",
    icon: "📚",
    category: "reading",
    tier: "silver",
    criteria: { booksRead: 25 },
  },
  {
    id: "bibliophile",
    name: "Bibliophile",
    description: "Read 50 books",
    icon: "📕",
    category: "reading",
    tier: "gold",
    criteria: { booksRead: 50 },
  },
  {
    id: "library-legend",
    name: "Library Legend",
    description: "Read 100 books",
    icon: "🏛️",
    category: "reading",
    tier: "platinum",
    criteria: { booksRead: 100 },
  },

  // ========================================
  // PAGES BADGES
  // ========================================
  {
    id: "page-turner",
    name: "Page Turner",
    description: "Read 1,000 pages",
    icon: "📄",
    category: "pages",
    tier: "bronze",
    criteria: { pagesRead: 1000 },
  },
  {
    id: "marathon-reader",
    name: "Marathon Reader",
    description: "Read 5,000 pages",
    icon: "🏃",
    category: "pages",
    tier: "silver",
    criteria: { pagesRead: 5000 },
  },
  {
    id: "page-master",
    name: "Page Master",
    description: "Read 10,000 pages",
    icon: "📜",
    category: "pages",
    tier: "gold",
    criteria: { pagesRead: 10000 },
  },
  {
    id: "endless-reader",
    name: "Endless Reader",
    description: "Read 25,000 pages",
    icon: "♾️",
    category: "pages",
    tier: "platinum",
    criteria: { pagesRead: 25000 },
  },

  // ========================================
  // REVIEW BADGES
  // ========================================
  {
    id: "first-review",
    name: "Voice Found",
    description: "Write your first review",
    icon: "💬",
    category: "reviews",
    tier: "bronze",
    criteria: { reviewsWritten: 1 },
  },
  {
    id: "reviewer",
    name: "Thoughtful Reviewer",
    description: "Write 10 reviews",
    icon: "✏️",
    category: "reviews",
    tier: "silver",
    criteria: { reviewsWritten: 10 },
  },
  {
    id: "critic",
    name: "Literary Critic",
    description: "Write 25 reviews",
    icon: "🎭",
    category: "reviews",
    tier: "gold",
    criteria: { reviewsWritten: 25 },
  },
  {
    id: "super-fan",
    name: "Super Fan",
    description: "Give 10 five-star ratings",
    icon: "🌟",
    category: "reviews",
    tier: "silver",
    criteria: { fiveStarReviews: 10 },
  },

  // ========================================
  // DEDICATION BADGES
  // ========================================
  {
    id: "monthly-goal",
    name: "Monthly Reader",
    description: "Read 5 books in one month",
    icon: "📅",
    category: "streaks",
    tier: "silver",
    criteria: { booksInOneMonth: 5 },
  },
  {
    id: "yearly-goal-12",
    name: "Year of Reading",
    description: "Read 12 books in one year",
    icon: "📆",
    category: "streaks",
    tier: "bronze",
    criteria: { booksInOneYear: 12 },
  },
  {
    id: "yearly-goal-24",
    name: "Dedicated Reader",
    description: "Read 24 books in one year",
    icon: "🎯",
    category: "streaks",
    tier: "silver",
    criteria: { booksInOneYear: 24 },
  },
  {
    id: "yearly-goal-52",
    name: "Book a Week",
    description: "Read 52 books in one year",
    icon: "🏆",
    category: "streaks",
    tier: "platinum",
    criteria: { booksInOneYear: 52 },
  },
  {
    id: "challenge-champion",
    name: "Challenge Champion",
    description: "Complete 5 reading challenges",
    icon: "🎖️",
    category: "streaks",
    tier: "gold",
    criteria: { challengesCompleted: 5 },
  },

  // ========================================
  // GENRE BADGES
  // ========================================
  {
    id: "fantasy-fan",
    name: "Fantasy Explorer",
    description: "Read 10 Fantasy books",
    icon: "🧙",
    category: "genres",
    tier: "silver",
    criteria: { genreBooksRead: { genre: "Fantasy", count: 10 } },
  },
  {
    id: "mystery-maven",
    name: "Mystery Maven",
    description: "Read 10 Mystery books",
    icon: "🔍",
    category: "genres",
    tier: "silver",
    criteria: { genreBooksRead: { genre: "Mystery", count: 10 } },
  },
  {
    id: "scifi-voyager",
    name: "Sci-Fi Voyager",
    description: "Read 10 Science Fiction books",
    icon: "🚀",
    category: "genres",
    tier: "silver",
    criteria: { genreBooksRead: { genre: "Science Fiction", count: 10 } },
  },
  {
    id: "romance-reader",
    name: "Hopeless Romantic",
    description: "Read 10 Romance books",
    icon: "💕",
    category: "genres",
    tier: "silver",
    criteria: { genreBooksRead: { genre: "Romance", count: 10 } },
  },
  {
    id: "nonfiction-nerd",
    name: "Knowledge Seeker",
    description: "Read 10 Non-Fiction books",
    icon: "🧠",
    category: "genres",
    tier: "silver",
    criteria: { genreBooksRead: { genre: "Non-Fiction", count: 10 } },
  },

  // ========================================
  // CHECK-IN BADGES
  // ========================================
  {
    id: "first-checkin",
    name: "Explorer",
    description: "Check in at your first reading spot",
    icon: "📍",
    category: "checkins",
    tier: "bronze",
    criteria: { totalCheckins: 1 },
  },
  {
    id: "regular-visitor",
    name: "Regular Visitor",
    description: "Check in 10 times at reading spots",
    icon: "🏪",
    category: "checkins",
    tier: "bronze",
    criteria: { totalCheckins: 10 },
  },
  {
    id: "local-reader",
    name: "Local Reader",
    description: "Check in 50 times at reading spots",
    icon: "🏘️",
    category: "checkins",
    tier: "silver",
    criteria: { totalCheckins: 50 },
  },
  {
    id: "reading-nomad",
    name: "Reading Nomad",
    description: "Check in 100 times at reading spots",
    icon: "🌍",
    category: "checkins",
    tier: "gold",
    criteria: { totalCheckins: 100 },
  },
  {
    id: "weekly-wanderer",
    name: "Weekly Wanderer",
    description: "Maintain a 7-day check-in streak",
    icon: "🔥",
    category: "checkins",
    tier: "silver",
    criteria: { checkinStreak: 7 },
  },
  {
    id: "monthly-explorer",
    name: "Monthly Explorer",
    description: "Maintain a 30-day check-in streak",
    icon: "🏆",
    category: "checkins",
    tier: "platinum",
    criteria: { checkinStreak: 30 },
  },

  // ========================================
  // SPECIAL BADGES
  // ========================================
  {
    id: "early-adopter",
    name: "Early Adopter",
    description: "Join OhMyReads in its early days",
    icon: "🌟",
    category: "special",
    tier: "gold",
    criteria: { accountAgeDays: 0 }, // Will check registration before a certain date
  },
  {
    id: "one-year-member",
    name: "Loyal Reader",
    description: "Be a member for 1 year",
    icon: "🎂",
    category: "special",
    tier: "silver",
    criteria: { accountAgeDays: 365 },
  },
];

// Helper to get badge by ID
export function getBadgeById(id: string): BadgeDefinition | undefined {
  return BADGES.find((badge) => badge.id === id);
}
