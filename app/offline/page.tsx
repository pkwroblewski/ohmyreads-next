import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = {
  title: "You're offline",
  robots: { index: false, follow: false },
};

/**
 * The page the service worker serves when a navigation fails. Reads nothing
 * per request, so it is a static shell that can sit in the SW cache without
 * ever carrying one reader's data to another.
 */
export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <WifiOff className="w-12 h-12 mx-auto text-muted-foreground" aria-hidden="true" />
        <h1 className="text-2xl font-bold font-serif">You&apos;re offline</h1>
        <p className="text-muted-foreground">
          OhMyReads needs a connection to load your shelves and the community.
          Your reading data is safe; try again once you&apos;re back online.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
        >
          Try again
        </Link>
      </div>
    </main>
  );
}
