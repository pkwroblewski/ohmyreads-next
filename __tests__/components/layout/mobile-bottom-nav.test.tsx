/**
 * Mobile "More" sheet (Phase 2, Task 20).
 *
 * It used to be a div toggled by state: no Escape handling, focus stayed on
 * the page behind it, nothing was announced. Now it is a dialog owned by the
 * More button.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

let pathname = "/dashboard";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

beforeEach(() => {
  cleanup();
  pathname = "/dashboard";
});

describe("MobileBottomNav", () => {
  it("marks the current primary item and keeps the sheet closed", () => {
    render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Shelf" }).getAttribute("aria-current")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a dialog from the More button, closes it on Escape and returns focus", async () => {
    render(<MobileBottomNav />);
    const more = screen.getByRole("button", { name: "More pages" });
    expect(more.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(more);
    const dialog = await screen.findByRole("dialog", { name: "More" });
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(dialog.querySelectorAll("a").length).toBe(11);
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(more));
  });

  it("closes from its own close button", async () => {
    render(<MobileBottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "More pages" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("lights the More button when an overflow page is current", () => {
    pathname = "/settings";
    render(<MobileBottomNav />);
    expect(screen.getByRole("button", { name: "More pages" }).className).toContain("text-primary");
  });
});
