// User Profile
export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  website: string | null;
  is_admin: boolean;
  admin_granted_at: string | null;
  admin_granted_by: string | null;
  followers_count: number;
  following_count: number;
  friends_count: number;
  unread_messages_count: number;
  discovery_visible: boolean;
  created_at: string;
  updated_at: string;
}

// Admin role change audit record
export interface AdminRoleChange {
  id: string;
  user_id: string;
  changed_by: string | null;
  action: "granted" | "revoked";
  source: "env_initial" | "admin_action" | "system";
  reason: string | null;
  created_at: string;
}

// Book
export interface Book {
  id: string;
  title: string;
  author: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  isbn: string | null;
  published_date: string | null;
  page_count: number | null;
  genres: string[];
  google_books_id: string | null;
  open_library_id: string | null;
  open_library_cover_id: number | null;
  cover_source: "google" | "openlibrary" | "user" | "other" | null;
  average_rating: number | null;
  ratings_count: number;
  created_at: string;
}

// User's Book (shelf item)
export type BookStatus = "want_to_read" | "reading" | "read";

export interface UserBook {
  id: string;
  user_id: string;
  book_id: string;
  status: BookStatus;
  rating: number | null;
  current_page: number | null;
  total_pages: number | null;
  progress_percentage: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

// Review (with structured review fields and vibe tags)
export interface Review {
  id: string;
  user_id: string;
  book_id: string;
  content: string;
  summary: string | null;
  liked: string | null;
  disliked: string | null;
  takeaway: string | null;
  vibe_tags: string[];
  rating: number | null;
  likes_count: number;
  is_spoiler: boolean;
  created_at: string;
  updated_at: string;
}

// Comment
export interface Comment {
  id: string;
  review_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

// Social Link
export interface SocialLink {
  id: string;
  user_id: string;
  platform: string;
  url: string;
  display_order: number;
  created_at: string;
}

// Reading Stats
export interface ReadingStats {
  user_id: string;
  books_read: number;
  pages_read: number;
  reviews_count: number;
  current_streak: number;
  updated_at: string;
}

// Reading Goal
export interface ReadingGoal {
  id: string;
  user_id: string;
  year: number;
  target_books: number;
  created_at: string;
  updated_at: string;
}

// Reading Progress History (for analytics)
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

// Reading Challenge
export type ChallengeType = "books_count" | "pages_count" | "genre_books";
export type ChallengeStatus = "active" | "completed" | "failed" | "abandoned";

export interface ReadingChallenge {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  challenge_type: ChallengeType;
  target_value: number;
  genre: string | null;
  start_date: string;
  end_date: string;
  current_value: number;
  status: ChallengeStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Challenge with computed progress
export interface ChallengeWithProgress extends ReadingChallenge {
  progress_percentage: number;
  days_remaining: number;
  is_on_track: boolean;
}

// User Badge (earned achievement)
export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  unlocked_at: string;
}

// Follow relationship
export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
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

// ============================================
// Friend Request Types
// ============================================

export type FriendRequestStatus = "pending" | "accepted" | "rejected";

// Friend request
export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: FriendRequestStatus;
  created_at: string;
  responded_at: string | null;
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

// Friendship status for UI display
export type FriendshipStatus =
  | "none"           // No relationship
  | "pending_sent"   // Current user sent request
  | "pending_received" // Current user received request
  | "friends";       // Accepted friendship

// ============================================
// Direct Message Types
// ============================================

// Direct message
export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
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

// User Taste Profile (for personalized recommendations)
export type PacePreference = "slow" | "medium" | "fast";
export type LengthPreference = "short" | "medium" | "long";

export interface UserTasteProfile {
  id: string;
  user_id: string;
  preferred_genres: string[];
  preferred_vibes: string[];
  preferred_pace: PacePreference | null;
  preferred_length: LengthPreference | null;
  seed_book_ids: string[];
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

// Standard Vibe Tags
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

// Book Submission (for user-submitted books with moderation)
export type BookSubmissionStatus = "pending" | "approved" | "rejected";

export interface BookSubmission {
  id: string;
  submitted_by: string;
  title: string;
  author: string;
  isbn: string | null;
  slug: string;
  description: string | null;
  cover_url: string | null;
  genres: string[];
  published_date: string | null;
  page_count: number | null;
  status: BookSubmissionStatus;
  moderated_by: string | null;
  moderated_at: string | null;
  rejection_reason: string | null;
  book_id: string | null;
  created_at: string;
  updated_at: string;
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

// Review Like
export interface ReviewLike {
  id: string;
  review_id: string;
  user_id: string;
  created_at: string;
}

// ============================================
// Helper Types (with relations)
// ============================================

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

// Place Check-in
export interface PlaceCheckin {
  id: string;
  place_id: string;
  user_id: string;
  book_id: string | null;
  note: string | null;
  created_at: string;
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

// User check-in stats (for streaks)
export interface UserCheckinStats {
  user_id: string;
  total_checkins: number;
  current_streak: number;
  longest_streak: number;
  last_checkin_date: string | null;
  updated_at: string;
}

// Activity Feed Item (for community page)
export type ActivityType = "review" | "started_reading" | "checkin";

export interface ActivityFeedItem {
  id: string;
  type: ActivityType;
  user_id: string;
  book_id: string | null;
  review_id: string | null;
  place_id: string | null;
  checkin_id: string | null;
  created_at: string;
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

// ============================================
// Custom Shelves Types
// ============================================

// Custom user shelf (like Goodreads custom shelves)
export interface UserShelf {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  color: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Book assigned to a shelf
export interface ShelfBook {
  id: string;
  shelf_id: string;
  user_book_id: string;
  added_at: string;
  notes: string | null;
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

export type ClubVisibility = "public" | "private";
export type ClubMemberRole = "admin" | "member";
export type ClubReadStatus = "current" | "completed";

// Book club
export interface BookClub {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  visibility: ClubVisibility;
  created_by: string | null;
  member_count: number;
  created_at: string;
  updated_at: string;
}

// Book club member
export interface BookClubMember {
  club_id: string;
  user_id: string;
  role: ClubMemberRole;
  joined_at: string;
}

// Book club member with profile
export interface BookClubMemberWithProfile extends BookClubMember {
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// Book club read (current or past book)
export interface BookClubRead {
  id: string;
  club_id: string;
  book_id: string;
  status: ClubReadStatus;
  started_at: string;
  completed_at: string | null;
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

export type ListVisibility = "public" | "private";

// Reading list
export interface ReadingList {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  description: string | null;
  visibility: ListVisibility;
  likes_count: number;
  created_at: string;
  updated_at: string;
}

// Reading list book
export interface ReadingListBook {
  list_id: string;
  book_id: string;
  position: number;
  note: string | null;
  added_at: string;
}

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

