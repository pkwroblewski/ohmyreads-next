/**
 * Mobile "More" sheet (Phase 2, Task 20; UX fixes Task 4).
 *
 * It used to be a div toggled by state: no Escape handling, focus stayed on
 * the page behind it, nothing was announced. Now it is a dialog owned by the
 * More button. Since Task 4 it also carries Messages (a button that opens
 * the chat panel, with the unread badge), Map and About.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

let pathname = "/dashboard";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { ChatPanelContext } from "@/components/messages/chat-context";

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
    expect(dialog.querySelectorAll("a").length).toBe(13);
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Map" }).getAttribute("href")).toBe("/community/map");
    expect(screen.getByRole("link", { name: "About" }).getAttribute("href")).toBe("/about");

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

  it("offers Messages as a button that opens the chat panel and closes the sheet", async () => {
    const openChat = vi.fn();
    render(
      <ChatPanelContext.Provider value={{ openChat, unreadCount: 3 }}>
        <MobileBottomNav />
      </ChatPanelContext.Provider>
    );
    fireEvent.click(screen.getByRole("button", { name: "More pages" }));
    await screen.findByRole("dialog");

    const messages = screen.getByRole("button", { name: /^Messages/ });
    expect(messages.textContent).toContain("3");
    expect(messages.textContent).toContain("unread");

    fireEvent.click(messages);
    expect(openChat).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows no badge without unread messages and is a no-op without a provider", async () => {
    render(<MobileBottomNav />);
    fireEvent.click(screen.getByRole("button", { name: "More pages" }));
    await screen.findByRole("dialog");
    const messages = screen.getByRole("button", { name: "Messages" });
    expect(messages.textContent).toBe("Messages");
    fireEvent.click(messages);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
