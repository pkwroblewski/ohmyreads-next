// User Profile
export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  website: string | null;
  created_at: string;
  updated_at: string;
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
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

// Review
export interface Review {
  id: string;
  user_id: string;
  book_id: string;
  content: string;
  rating: number;
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
  parent_id: string | null;
  content: string;
  created_at: string;
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
  profile: Profile;
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

