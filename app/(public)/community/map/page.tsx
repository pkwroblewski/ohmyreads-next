import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ArrowLeft, Settings, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReaderMapImmersive } from "@/components/geo/reader-map-immersive";
import { MapEventsPanel } from "@/components/geo/map-events-panel";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Reader Map | OhMyReads",
  description:
    "Discover readers and book-friendly places near you. Find bookstores, libraries, and cafes in your area.",
  openGraph: {
    title: "Reader Map | OhMyReads",
    description: "Discover readers and book-friendly places near you.",
  },
};

export default async function ReaderMapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="h-[calc(100vh-4rem)] bg-gradient-to-br from-background via-muted/30 to-background p-4 lg:p-6">
      <div className="flex h-full gap-4 lg:gap-6">
        {/* Map Container - Premium curved box */}
        <div className="relative flex-1 rounded-3xl overflow-hidden shadow-warm-lg dark:shadow-none border border-border/50 bg-card">
          {/* Subtle inner glow effect */}
          <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10 pointer-events-none z-10" />

          {/* Back Button - Top Left */}
          <div className="absolute top-4 left-4 z-30">
            <Link href="/community">
              <Button
                variant="secondary"
                size="icon"
                className="h-10 w-10 rounded-full shadow-lg bg-white/90 dark:bg-card/90 backdrop-blur-xl border border-white/50 dark:border-border/50"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Floating Action Buttons - Top Right */}
          <div className="absolute top-4 right-4 z-30 flex gap-2">
            {/* Settings - logged-in only */}
            {user && (
              <Link href="/settings">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10 rounded-full shadow-lg bg-white/90 dark:bg-card/90 backdrop-blur-xl border border-white/50 dark:border-border/50"
                  title="Location Settings"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </Link>
            )}
            {/* Add Place - visible to all */}
            <Link href="/community/map/submit">
              <Button
                size="icon"
                className="h-10 w-10 rounded-full shadow-lg"
                title="Add Place"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Privacy Info Button - Bottom Left */}
          <div className="absolute bottom-6 left-4 z-10">
            <Link href="/privacy">
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full shadow-lg text-xs opacity-80 hover:opacity-100 bg-white/90 dark:bg-card/90 backdrop-blur-xl border border-white/50 dark:border-border/50"
              >
                <Info className="h-3 w-3 mr-1" />
                Privacy
              </Button>
            </Link>
          </div>

          {/* Map Component */}
          <ReaderMapImmersive currentUserId={user?.id} />
        </div>

        {/* Events Panel - Desktop only */}
        <div className="hidden lg:flex">
          <MapEventsPanel />
        </div>
      </div>
    </div>
  );
}
