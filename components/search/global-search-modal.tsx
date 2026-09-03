"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { UnifiedSearch } from "@/components/search/unified-search";

interface GlobalSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Top-anchored ⌘K search dialog hosting the compact UnifiedSearch variant.
 * Owns the global Ctrl/Cmd+K hotkey (toggles regardless of open state).
 *
 * A Radix Dialog rather than a bare div: it gives the palette a dialog role,
 * keeps Tab inside it, closes on Escape and on the backdrop, and puts focus
 * back on whatever opened it when it closes.
 */
export function GlobalSearchModal({ open, onOpenChange }: GlobalSearchModalProps) {
  // Whatever had focus when the palette opened (a top-bar button, or the
  // page body for ⌘K). Radix would send focus to its own Trigger on close,
  // and this dialog is opened from outside, so it has none — without this
  // focus would land on <body>. A layout effect runs before Radix's focus
  // scope moves focus into the dialog.
  const openerRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) {
      openerRef.current = document.activeElement as HTMLElement | null;
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-[10%] z-50 w-full max-w-xl -translate-x-1/2 px-4 focus:outline-none"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            openerRef.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">Search books and authors</Dialog.Title>
          <div className="relative rounded-xl border bg-background p-4 shadow-2xl">
            <Dialog.Close
              className="absolute -top-2 -right-2 z-10 rounded-full border bg-background p-1.5 shadow hover:bg-muted transition-colors"
              aria-label="Close search"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
            <UnifiedSearch
              variant="modal"
              onNavigate={() => onOpenChange(false)}
              placeholder="Search books or authors..."
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
