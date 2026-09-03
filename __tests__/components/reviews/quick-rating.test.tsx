/**
 * Inline star control on the book page (Phase 2, Task 20).
 *
 * A rating alone is a valid review, so the stars post a rating-only review
 * without the full form — or change the reader's existing review's rating.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const { createReview, updateReview, toast, refresh } = vi.hoisted(() => ({
  createReview: vi.fn(),
  updateReview: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  refresh: vi.fn(),
}));

vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/actions/reviews", () => ({ createReview, updateReview }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

import { QuickRating } from "@/components/reviews/quick-rating";

const BOOK = "550e8400-e29b-41d4-a716-446655440020";
const REVIEW = "550e8400-e29b-41d4-a716-446655440021";

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("QuickRating", () => {
  it("is a radio group of five stars named after the book", () => {
    render(<QuickRating bookId={BOOK} bookTitle="Dune" initialRating={null} reviewId={null} />);
    expect(screen.getByRole("radiogroup", { name: "Rate Dune" })).toBeTruthy();
    expect(screen.getAllByRole("radio").length).toBe(5);
    expect(screen.getByRole("radio", { name: "1 star" }).getAttribute("aria-checked")).toBe("false");
  });

  it("posts a rating-only review when the reader has none", async () => {
    createReview.mockResolvedValue({ success: true, reviewId: REVIEW });
    render(<QuickRating bookId={BOOK} bookTitle="Dune" initialRating={null} reviewId={null} />);

    fireEvent.click(screen.getByRole("radio", { name: "4 stars" }));

    await waitFor(() => expect(createReview).toHaveBeenCalledTimes(1));
    expect(createReview).toHaveBeenCalledWith({
      bookId: BOOK,
      rating: 4,
      vibeTags: [],
      isSpoiler: false,
    });
    expect(updateReview).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: "4 stars" }).getAttribute("aria-checked")).toBe("true");
    await waitFor(() => expect(refresh).toHaveBeenCalled());

    // The next click edits the review that was just created.
    updateReview.mockResolvedValue({ success: true });
    fireEvent.click(screen.getByRole("radio", { name: "2 stars" }));
    await waitFor(() => expect(updateReview).toHaveBeenCalledWith({ reviewId: REVIEW, rating: 2 }));
    expect(createReview).toHaveBeenCalledTimes(1);
  });

  it("updates the existing review instead of creating a second one", async () => {
    updateReview.mockResolvedValue({ success: true });
    render(<QuickRating bookId={BOOK} bookTitle="Dune" initialRating={3} reviewId={REVIEW} />);

    expect(screen.getByRole("radio", { name: "3 stars" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "5 stars" }));

    await waitFor(() => expect(updateReview).toHaveBeenCalledWith({ reviewId: REVIEW, rating: 5 }));
    expect(createReview).not.toHaveBeenCalled();
  });

  it("rolls the stars back and reports the error when the action fails", async () => {
    createReview.mockResolvedValue({ error: "Too many reviews" });
    render(<QuickRating bookId={BOOK} bookTitle="Dune" initialRating={null} reviewId={null} />);

    fireEvent.click(screen.getByRole("radio", { name: "5 stars" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Too many reviews"));
    expect(screen.getByRole("radio", { name: "5 stars" }).getAttribute("aria-checked")).toBe("false");
    expect(refresh).not.toHaveBeenCalled();
  });
});
