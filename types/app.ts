// App-level types that do not correspond 1:1 to a database table: narrowed
// string unions for CHECK-constrained TEXT columns, view models built on top
// of table rows, and UI constants. Table row types live in ./database (an
// alias shim over the generated schema in ./database.generated).
import type { Database } from "./database.generated";
import type {
  ActivityFeedItem,
  Book,
  BookClub,
  BookClubMember,
  BookClubRead,
  BookSubmission,
  Comment,
  DirectMessage,
  Follow,
  FriendRequest,
  PlaceCheckin,
  Profile,
  ReadingChallenge,
  ReadingList,
  ReadingListBook,
  Review,
  ShelfBook,
  UserBook,
  UserShelf,
} from "./database";

// ============================================
// Narrowed string unions
// The DB stores these columns as CHECK-constrained TEXT, so the generated
// types say `string`. These aliases preserve the app-level narrowing.
// ============================================

export type AdminRoleAction = "granted" | "revoked";
export type AdminRoleSource = "env_initial" | "admin_action" | "system";
export type CoverSource = "google" | "openlibrary" | "user" | "other";
export type BookStatus = "want_to_read" | "reading" | "read";
export type FriendRequestStatus = "pending" | "accepted" | "rejected";
export type BookSubmissionStatus = "pending" | "approved" | "rejected";
export type ActivityType = "review" | "started_reading" | "checkin";
export type ClubVisibility = "public" | "private";
export type ClubMemberRole = "admin" | "member";
export type ClubReadStatus = "current" | "completed";
export type ListVisibility = "public" | "private";
export type PacePreference = "slow" | "medium" | "fast";
export type LengthPreference = "short" | "medium" | "long";

// Real Postgres enums — aliased from the generated definitions
export type ChallengeType = Database["public"]["Enums"]["challenge_type"];
export type ChallengeStatus = Database["public"]["Enums"]["challenge_status"];

// Friendship status for UI display
export type FriendshipStatus =
  | "none"           // No relationship
  | "pending_sent"   // Current user sent request
  | "pending_received" // Current user received request
  | "friends";       // Accepted friendship

// ============================================
// Standard Vibe Tags
// ============================================

export const VIBE_TAGS = {
  // Emotional tone
  emotional: [
    "heartwarming",
    "dark",
    "funny",
    "emotional",
    "intense",
    "hopeful",
    "melancholic",
    "inspiring",
  ],
  // Pacing/Style
  style: [
    "slow-burn",
    "page-turner",
    "atmospheric",
    "immersive",
    "thought-provoking",
    "cozy",
    "adventurous",
  ],
  // Character focus
  character: [
    "character-driven",
    "plot-driven",
    "ensemble-cast",
    "unreliable-narrator",
  ],
  // Reading experience
  experience: [
    "quick-read",
    "dense",
    "literary",
    "accessible",
    "challenging",
  ],
} as const;

// Flat list of all vibe tags
export const ALL_VIBE_TAGS = [
  ...VIBE_TAGS.emotional,
  ...VIBE_TAGS.style,
  ...VIBE_TAGS.character,
  ...VIBE_TAGS.experience,
] as const;

export type VibeTag = (typeof ALL_VIBE_TAGS)[number];

// ============================================
// Types without a backing table
// ============================================

// Reading Progress History (for analytics)
// TODO: NO backing table exists in the DB (and no migration in the repo) —
// `user_books` also lacks current_page/total_pages/progress_percentage.
// Reading-progress storage is deferred to the feature-wireups plan.
export interface ReadingProgressHistory {
  id: string;
  user_id: string;
  user_book_id: string;
  book_id: string;
  current_page: number;
  total_pages: number;
  progress_percentage: number;
  pages_read_in_session: number;
  created_at: string;
}

// ============================================
// Helper Types (with relations)
// ============================================

// Challenge with computed progress
export interface ChallengeWithProgress extends ReadingChallenge {
  progress_percentage: number;
  days_remaining: number;
  is_on_track: boolean;
}

// Follow with user profile info
export interface FollowWithProfile extends Follow {
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// Friend request with sender profile (for incoming requests)
export interface FriendRequestWithSender extends FriendRequest {
  sender: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// Friend request with receiver profile (for sent requests)
export interface FriendRequestWithReceiver extends FriendRequest {
  receiver: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// Direct message with sender profile
export interface DirectMessageWithSender extends DirectMessage {
  sender: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// Conversation preview for chat list
export interface ConversationPreview {
  friend_id: string;
  friend_username: string;
  friend_display_name: string | null;
  friend_avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

// Book Submission with Submitter profile
export interface BookSubmissionWithSubmitter extends BookSubmission {
  submitter?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// Book with user's reading status
export interface BookWithUserStatus extends Book {
  user_book?: UserBook | null;
}

// Review with user profile
export interface ReviewWithUser extends Review {
  profile: Profile;
}

// Comment with user profile
export interface CommentWithUser extends Comment {
  user?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// Review with user and book
export interface ReviewWithUserAndBook extends ReviewWithUser {
  book: Book;
}

// User book with book details
export interface UserBookWithBook extends UserBook {
  book: Book;
}

// Comment with nested replies
export interface CommentWithReplies extends CommentWithUser {
  replies?: CommentWithReplies[];
}

// Check-in with relations (for display)
export interface CheckinWithRelations extends PlaceCheckin {
  user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  book?: {
    id: string;
    title: string;
    author: string;
    slug: string;
    cover_url: string | null;
  } | null;
  place: {
    id: string;
    name: string;
    place_type: string;
  };
}

// Activity Feed Item with relations (for display)
export interface ActivityFeedItemWithRelations extends ActivityFeedItem {
  user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  book?: {
    id: string;
    title: string;
    author: string;
    slug: string;
    cover_url: string | null;
  } | null;
  review?: {
    id: string;
    rating: number | null;
    content: string | null;
    likes_count: number;
  } | null;
  place?: {
    id: string;
    name: string;
    place_type: string;
  } | null;
  checkin?: {
    id: string;
    note: string | null;
  } | null;
}

// Shelf with book count
export interface UserShelfWithCount extends UserShelf {
  book_count: number;
}

// Shelf book with book details
export interface ShelfBookWithBook extends ShelfBook {
  user_book: UserBook & {
    book: Book;
  };
}

// ============================================
// Reader Discovery Types
// ============================================

// Compatibility level for reader matching
export type CompatibilityLevel = "high" | "medium" | "low" | "unknown";

// Reader with compatibility data (for discovery)
export interface ReaderWithCompatibility {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers_count: number;
  following_count: number;
  books_count: number;
  reviews_count: number;
  compatibility: CompatibilityLevel;
  compatibility_score: number; // 0-100 for sorting
  shared_books: number;
  shared_genres: string[];
  shared_vibes: string[];
}

// Filters for reader search/browse
export interface ReaderSearchFilters {
  query?: string;
  genres?: string[];
  activityLevel?: "any" | "active" | "prolific";
  sortBy?: "compatibility" | "activity" | "followers" | "recent";
}

// Taste data for compatibility calculation
export interface ReaderTasteData {
  genres: string[];
  vibes: string[];
  bookIds: string[];
}

// ============================================
// Book Club Types
// ============================================

// Book club member with profile
export interface BookClubMemberWithProfile extends BookClubMember {
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// Book club read with book details
export interface BookClubReadWithBook extends BookClubRead {
  book: {
    id: string;
    title: string;
    author: string;
    slug: string;
    cover_url: string | null;
  };
}

// Book club with current read and creator
export interface BookClubWithDetails extends BookClub {
  current_read?: BookClubReadWithBook | null;
  creator?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  is_member?: boolean;
  user_role?: ClubMemberRole | null;
}

// ============================================
// Reading List Types
// ============================================

// Reading list book with book details
export interface ReadingListBookWithBook extends ReadingListBook {
  book: {
    id: string;
    title: string;
    author: string;
    slug: string;
    cover_url: string | null;
  };
}

// Reading list with books and owner
export interface ReadingListWithDetails extends ReadingList {
  owner: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  books: ReadingListBookWithBook[];
  book_count: number;
  is_liked?: boolean;
}
