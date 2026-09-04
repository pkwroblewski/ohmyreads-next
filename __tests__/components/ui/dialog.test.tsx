/**
 * Shared Dialog and DropdownMenu primitives (UX fixes, Task 1).
 *
 * The hand-rolled modals and menus they replace had decorative ARIA only:
 * no focus trap, no arrow keys, focus lost on close. These tests pin the
 * behaviour the migrations in Tasks 2–3 rely on.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

beforeEach(() => {
  cleanup();
});

/** Controlled dialog with no DialogTrigger — the shape most callers have. */
function ControlledDialog() {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={openerRef} onClick={() => setOpen(true)}>
        Open it
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent returnFocusTo={openerRef}>
          <DialogHeader>
            <DialogTitle>Update progress</DialogTitle>
            <DialogDescription>Where are you up to?</DialogDescription>
          </DialogHeader>
          <input aria-label="Current page" />
          <DialogFooter>
            <button onClick={() => setOpen(false)}>Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("renders a modal dialog and moves focus into it", async () => {
    render(<ControlledDialog />);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open it" }));
    const dialog = await screen.findByRole("dialog", { name: "Update progress" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("Where are you up to?").id).toBe(
      dialog.getAttribute("aria-describedby")
    );
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });

  it("closes on Escape and returns focus to returnFocusTo", async () => {
    render(<ControlledDialog />);
    const opener = screen.getByRole("button", { name: "Open it" });
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog");

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("closes from the corner close button", async () => {
    render(<ControlledDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Open it" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

function Menu({ onSelect }: { onSelect: (value: string) => void }) {
  const [sort, setSort] = useState("title");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Shelf actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => onSelect("progress")}>Update progress</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelect("move")}>Move to shelf</DropdownMenuItem>
        <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
          <DropdownMenuRadioItem value="title">By title</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="author">By author</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuItem variant="destructive" onSelect={() => onSelect("remove")}>
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe("DropdownMenu", () => {
  it("opens from the keyboard with real menu roles and moves highlight with ArrowDown", async () => {
    render(<Menu onSelect={() => {}} />);
    const trigger = screen.getByRole("button", { name: "Shelf actions" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await screen.findByRole("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "Update progress",
      "Move to shelf",
      "Remove",
    ]);
    const radios = screen.getAllByRole("menuitemradio");
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
    expect(radios[1].getAttribute("aria-checked")).toBe("false");

    await waitFor(() => expect(document.activeElement).toBe(items[0]));
    fireEvent.keyDown(items[0], { key: "ArrowDown" });
    await waitFor(() => expect(document.activeElement).toBe(items[1]));
    expect(items[1].getAttribute("data-highlighted")).toBe("");
  });

  it("selects the highlighted item with Enter and closes", async () => {
    const onSelect = vi.fn();
    render(<Menu onSelect={onSelect} />);
    const trigger = screen.getByRole("button", { name: "Shelf actions" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await screen.findByRole("menu");
    const items = screen.getAllByRole("menuitem");
    await waitFor(() => expect(document.activeElement).toBe(items[0]));

    fireEvent.keyDown(items[0], { key: "ArrowDown" });
    await waitFor(() => expect(document.activeElement).toBe(items[1]));
    fireEvent.keyDown(items[1], { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("move");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("checks a radio item on select", async () => {
    render(<Menu onSelect={() => {}} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Shelf actions" }), { key: "ArrowDown" });
    await screen.findByRole("menu");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "By author" }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    fireEvent.keyDown(screen.getByRole("button", { name: "Shelf actions" }), { key: "ArrowDown" });
    await screen.findByRole("menu");
    expect(screen.getByRole("menuitemradio", { name: "By author" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("menuitemradio", { name: "By title" }).getAttribute("aria-checked")).toBe("false");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    render(<Menu onSelect={() => {}} />);
    const trigger = screen.getByRole("button", { name: "Shelf actions" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const menu = await screen.findByRole("menu");

    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("styles the destructive variant", async () => {
    render(<Menu onSelect={() => {}} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Shelf actions" }), { key: "ArrowDown" });
    await screen.findByRole("menu");
    expect(screen.getByRole("menuitem", { name: "Remove" }).className).toContain("text-destructive");
  });
});
