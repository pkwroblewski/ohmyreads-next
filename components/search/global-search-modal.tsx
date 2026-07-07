"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { UnifiedSearch } from "@/components/search/unified-search";

interface GlobalSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Top-anchored ⌘K search dialog hosting the compact UnifiedSearch variant.
 * Owns the global Ctrl/Cmd+K hotkey (toggles regardless of open state).
 */
export function GlobalSearchModal({ open, onOpenChange }: GlobalSearchModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      // defaultPrevented guard: an inner dialog (AI mood search) or the
      // suggestion dropdown consumes its own Escape first
      if (e.key === "Escape" && open && !e.defaultPrevented) {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Top-anchored panel */}
      <div className="fixed left-1/2 top-[10%] w-full max-w-xl -translate-x-1/2 px-4">
        <div className="relative rounded-xl border bg-background p-4 shadow-2xl">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute -top-2 -right-2 z-10 rounded-full border bg-background p-1.5 shadow hover:bg-muted transition-colors"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
          <UnifiedSearch
            variant="modal"
            onNavigate={() => onOpenChange(false)}
            placeholder="Search books or authors..."
          />
        </div>
      </div>
    </div>
  );
}
