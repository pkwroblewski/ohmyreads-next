/**
 * Activity card "More options" menu (Phase 2, Task 10).
 *
 * Three cards used to render a "More options" button with no handler. Now a
 * review card carries a real menu (Copy link, and Report for a signed-in
 * reader looking at someone else's review), and the two activity types with
 * no reportable target — started reading, check-in — carry no button at all.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { ActivityFeedItemWithRelations } from "@/types/database";

const { submitReport, toast, writeText } = vi.hoisted(() => ({
  submitReport: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  writeText: vi.fn(),
}));

vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/actions/reports", () => ({ submitReport }));
vi.mock("@/lib/actions/reviews", () => ({ toggleReviewLike: vi.fn() }));
vi.mock("@/components/books/cover-image", () => ({
  CoverImage: () => <div data-testid="cover" />,
}));

import { ActivityCard } from "@/components/community/activity-card";

const AUTHOR = "550e8400-e29b-41d4-a716-446655440001";
const READER = "550e8400-e29b-41d4-a716-446655440002";
const REVIEW_ID = "550e8400-e29b-41d4-a716-446655440003";

const base = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  user_id: AUTHOR,
  created_at: "2026-09-01T00:00:00Z",
  book_id: "b1",
  review_id: null,
  place_id: null,
  checkin_id: null,
  user: { id: AUTHOR, username: "ada", display_name: "Ada", avatar_url: null },
  book: {
    id: "b1",
    title: "Dune",
    author: "Frank Herbert",
    slug: "dune",
    cover_url: null,
    isbn: null,
    google_books_id: null,
    open_library_cover_id: null,
    cover_source: null,
  },
};

const reviewItem: ActivityFeedItemWithRelations = {
  ...base,
  type: "review",
  review_id: REVIEW_ID,
  review: { id: REVIEW_ID, rating: 4, content: "Sand.", likes_count: 0 },
};

const startedItem: ActivityFeedItemWithRelations = { ...base, type: "started_reading" };

const checkinItem: ActivityFeedItemWithRelations = {
  ...base,
  type: "checkin",
  place_id: "p1",
  place: { id: "p1", name: "Corner Library", place_type: "library" },
  checkin: { id: "c1", note: null },
};

function openMenu() {
  const trigger = screen.getByRole("button", { name: "More options" });
  // Radix toggles on pointerdown; happy-dom's PointerEvent may not carry
  // `button`, so a keyboard open is the reliable path.
  fireEvent.keyDown(trigger, { key: "Enter" });
}

beforeEach(() => {
  cleanup();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

describe("ActivityCard menu", () => {
  it("renders no menu on a started-reading card", () => {
    render(<ActivityCard item={startedItem} isAuthenticated currentUserId={READER} />);
    expect(screen.queryByRole("button", { name: "More options" })).toBeNull();
  });

  it("renders no menu on a check-in card", () => {
    render(<ActivityCard item={checkinItem} isAuthenticated currentUserId={READER} />);
    expect(screen.queryByRole("button", { name: "More options" })).toBeNull();
  });

  it("offers Copy link and Report to a signed-in reader on someone else's review", async () => {
    render(<ActivityCard item={reviewItem} isAuthenticated currentUserId={READER} />);
    openMenu();
    expect(await screen.findByRole("menuitem", { name: /copy link/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /report/i })).toBeTruthy();
  });

  it("copies the review link", async () => {
    render(<ActivityCard item={reviewItem} isAuthenticated currentUserId={READER} />);
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /copy link/i }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/books/dune#reviews`);
    expect(toast.success).toHaveBeenCalled();
  });

  it("hides Report when signed out but keeps Copy link", async () => {
    render(<ActivityCard item={reviewItem} />);
    openMenu();
    expect(await screen.findByRole("menuitem", { name: /copy link/i })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /report/i })).toBeNull();
  });

  it("hides Report on the reader's own review", async () => {
    render(<ActivityCard item={reviewItem} isAuthenticated currentUserId={AUTHOR} />);
    openMenu();
    expect(await screen.findByRole("menuitem", { name: /copy link/i })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /report/i })).toBeNull();
  });

  it("Report opens the dialog for that review", async () => {
    render(<ActivityCard item={reviewItem} isAuthenticated currentUserId={READER} />);
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /report/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toMatch(/report this review/i);
    expect(screen.getByRole("button", { name: /send report/i })).toBeTruthy();
    await waitFor(() => expect(submitReport).not.toHaveBeenCalled());
  });
});
