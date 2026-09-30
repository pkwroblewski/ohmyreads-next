"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addStarterPicks } from "@/lib/actions/books";
import { readStarterPicks, writeStarterPicks } from "@/lib/starter-picks";

/**
 * Mounted in the signed-in shell: if this browser holds books picked on the
 * homepage before sign-up, put them on the reader's shelf once and forget
 * them. Works the same after email confirmation and Google sign-in, as long
 * as it is the same browser. Renders nothing.
 */
export function StarterPicksClaim() {
  const router = useRouter();
  const claimed = useRef(false);

  useEffect(() => {
    if (claimed.current) return;
    claimed.current = true;

    const picks = readStarterPicks();
    if (picks.length === 0) return;

    addStarterPicks(picks.map((b) => b.id)).then(
      (result) => {
        if (result.success) {
          writeStarterPicks([]);
          if (result.added > 0) {
            toast.success(
              result.added === 1
                ? "Your book from the homepage is on your shelf."
                : `Your ${result.added} books from the homepage are on your shelf.`
            );
            router.refresh();
          }
        } else if (result.error === "Invalid book IDs") {
          // Nothing usable in storage; don't retry on every page.
          writeStarterPicks([]);
        }
      },
      () => {
        // Network failure: keep the picks and try again on the next page load.
      }
    );
  }, [router]);

  return null;
}
