import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ArrowLeft, Settings, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReaderMapImmersive } from "@/components/geo/reader-map-immersive";
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
    <div className="relative h-[calc(100vh-4rem)]">
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

      {/* Floating Action Buttons - Top Right */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        {user ? (
          <>
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
          </>
        ) : (
          <Link href="/login?redirect=/community/map">
            <Button size="sm" className="rounded-full shadow-lg">
              Sign in
            </Button>
          </Link>
        )}
      </div>

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

      {/* Full-Page Map */}
      <ReaderMapImmersive currentUserId={user?.id} />
    </div>
  );
}

