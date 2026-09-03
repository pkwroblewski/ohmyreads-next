/**
 * The ⌘K search palette is a real dialog (Phase 2, Task 20).
 *
 * It used to be a plain fixed div: no dialog role, Tab wandered into the
 * page behind it, and focus was not restored on close.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

vi.mock("@/components/search/unified-search", () => ({
  UnifiedSearch: ({ placeholder }: { placeholder?: string }) => (
    <input aria-label="search" placeholder={placeholder} />
  ),
}));

import { GlobalSearchModal } from "@/components/search/global-search-modal";

beforeEach(cleanup);

describe("GlobalSearchModal", () => {
  it("renders nothing while closed", () => {
    render(<GlobalSearchModal open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is a named modal dialog that hides the page behind it", async () => {
    render(
      <>
        <button>outside</button>
        <GlobalSearchModal open onOpenChange={vi.fn()} />
      </>
    );
    const dialog = await screen.findByRole("dialog", { name: "Search books and authors" });
    expect(dialog.querySelector('input[aria-label="search"]')).toBeTruthy();
    // Radix marks everything outside the open dialog aria-hidden.
    await waitFor(() =>
      expect(screen.getByText("outside").closest("[aria-hidden='true']")).toBeTruthy()
    );
  });

  it("asks to close on Escape and on the close button", async () => {
    const onOpenChange = vi.fn();
    render(<GlobalSearchModal open onOpenChange={onOpenChange} />);
    const dialog = await screen.findByRole("dialog");

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    onOpenChange.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Close search" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("returns focus to whatever opened it, even though it has no Radix trigger", async () => {
    const Host = ({ open }: { open: boolean }) => (
      <>
        <button>opener</button>
        <GlobalSearchModal open={open} onOpenChange={vi.fn()} />
      </>
    );
    const { rerender } = render(<Host open={false} />);
    const opener = screen.getByText("opener");
    opener.focus();
    expect(document.activeElement).toBe(opener);

    rerender(<Host open />);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    rerender(<Host open={false} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("toggles on Ctrl/Cmd+K", () => {
    const onOpenChange = vi.fn();
    render(<GlobalSearchModal open={false} onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});
