// Alias shim over the generated schema types. Table row shapes come from
// types/database.generated.ts — run `npm run types:gen` after schema changes;
// never hand-write table fields here. Columns the DB stores as
// CHECK-constrained TEXT are re-narrowed to their union types from ./app.
// App-level (non-table) types live in ./app and are re-exported below.
import type { Database } from "./database.generated";
import type {
  ActivityType,
  AdminRoleAction,
  AdminRoleSource,
  BookStatus,
  BookSubmissionStatus,
  ClubMemberRole,
  ClubReadStatus,
  ClubVisibility,
  CoverSource,
  FriendRequestStatus,
  LengthPreference,
  ListVisibility,
  PacePreference,
} from "./app";

export type { Database, Json } from "./database.generated";

// User Profile
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Admin role change audit record
export type AdminRoleChange = Omit<
  Database["public"]["Tables"]["admin_role_changes"]["Row"],
  "action" | "source"
> & {
  action: AdminRoleAction;
  source: AdminRoleSource;
};

// Book. `fts` is the generated search vector: it is only ever a textSearch()
// filter target, never read off a row, so no query selects it (see
// lib/queries/columns.ts) and it is not part of the app-level shape.
export type Book = Omit<
  Database["public"]["Tables"]["books"]["Row"],
  "cover_source" | "fts"
> & {
  cover_source: CoverSource | null;
};

// A book as list/grid/rail consumers see it. `description` is ~70% of the row
// and is only rendered on the book detail page, so everything that shows books
// in bulk selects BOOK_CARD_COLUMNS (lib/queries/columns.ts) and gets this narrower shape.
export type BookSummary = Omit<Book, "description">;

// User's Book (shelf item)
export type UserBook = Omit<
  Database["public"]["Tables"]["user_books"]["Row"],
  "status"
> & {
  status: BookStatus;
};

// Review (with structured review fields and vibe tags)
export type Review = Database["public"]["Tables"]["reviews"]["Row"];

// Comment
export type Comment = Database["public"]["Tables"]["comments"]["Row"];

// Social Link
export type SocialLink = Database["public"]["Tables"]["social_links"]["Row"];

// Reading Stats
export type ReadingStats = Database["public"]["Tables"]["reading_stats"]["Row"];

// Reading Goal
export type ReadingGoal = Database["public"]["Tables"]["reading_goals"]["Row"];

// Reading Challenge (challenge_type/status are real Postgres enums)
export type ReadingChallenge =
  Database["public"]["Tables"]["reading_challenges"]["Row"];

// User Badge (earned achievement)
export type UserBadge = Database["public"]["Tables"]["user_badges"]["Row"];

// Follow relationship
export type Follow = Database["public"]["Tables"]["follows"]["Row"];

// Friend request
export type FriendRequest = Omit<
  Database["public"]["Tables"]["friend_requests"]["Row"],
  "status"
> & {
  status: FriendRequestStatus | null;
};

// Direct message
export type DirectMessage =
  Database["public"]["Tables"]["direct_messages"]["Row"];

// User Taste Profile (for personalized recommendations)
export type UserTasteProfile = Omit<
  Database["public"]["Tables"]["user_taste_profiles"]["Row"],
  "preferred_pace" | "preferred_length"
> & {
  preferred_pace: PacePreference | null;
  preferred_length: LengthPreference | null;
};

// Book Submission (for user-submitted books with moderation)
export type BookSubmission = Omit<
  Database["public"]["Tables"]["book_submissions"]["Row"],
  "status"
> & {
  status: BookSubmissionStatus | null;
};

// Review Like
export type ReviewLike = Database["public"]["Tables"]["review_likes"]["Row"];

// Place Check-in
export type PlaceCheckin =
  Database["public"]["Tables"]["place_checkins"]["Row"];

// User check-in stats (for streaks)
export type UserCheckinStats =
  Database["public"]["Tables"]["user_checkin_stats"]["Row"];

// Activity Feed Item (for community page)
export type ActivityFeedItem = Omit<
  Database["public"]["Tables"]["activity_feed"]["Row"],
  "type"
> & {
  type: ActivityType;
};

// Custom user shelf (like Goodreads custom shelves)
export type UserShelf = Database["public"]["Tables"]["user_shelves"]["Row"];

// Book assigned to a shelf
export type ShelfBook = Database["public"]["Tables"]["shelf_books"]["Row"];

// Book club
export type BookClub = Omit<
  Database["public"]["Tables"]["book_clubs"]["Row"],
  "visibility"
> & {
  visibility: ClubVisibility | null;
};

// Book club member
export type BookClubMember = Omit<
  Database["public"]["Tables"]["book_club_members"]["Row"],
  "role"
> & {
  role: ClubMemberRole | null;
};

// Book club read (current or past book)
export type BookClubRead = Omit<
  Database["public"]["Tables"]["book_club_reads"]["Row"],
  "status"
> & {
  status: ClubReadStatus | null;
};

// Reading list
export type ReadingList = Omit<
  Database["public"]["Tables"]["reading_lists"]["Row"],
  "visibility"
> & {
  visibility: ListVisibility | null;
};

// Reading list book
export type ReadingListBook =
  Database["public"]["Tables"]["reading_list_books"]["Row"];

// App-level types (view models, unions, constants) — keeps existing
// `@/types/database` imports working unchanged.
export * from "./app";
