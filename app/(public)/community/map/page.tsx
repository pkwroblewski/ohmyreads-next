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
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Map Section */}
      <div className="relative flex-1">
        {/* Back Button - Top Left */}
        <div className="absolute top-4 left-4 z-30">
          <Link href="/community">
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-full shadow-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        {/* Floating Action Buttons - Top Left (below back button) */}
        {user && (
          <div className="absolute top-16 left-4 z-30 flex flex-col gap-2">
            <Link href="/settings">
              <Button
                variant="secondary"
                size="icon"
                className="h-10 w-10 rounded-full shadow-lg"
                title="Location Settings"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
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
        )}

        {/* Privacy Info Button - Bottom Left */}
        <div className="absolute bottom-6 left-4 z-10">
          <Link href="/privacy">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full shadow-lg text-xs opacity-80 hover:opacity-100"
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
      <div className="hidden lg:flex w-80 xl:w-96 border-l border-border flex-col">
        <MapEventsPanel />
      </div>
    </div>
  );
}

