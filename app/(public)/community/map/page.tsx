import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReaderMap } from "@/components/geo/reader-map";
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container max-w-6xl py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/community">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold font-serif">Reader Map</h1>
                  <p className="text-muted-foreground text-sm">
                    Discover readers and book-friendly places near you
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <Link href="/settings">
                    <Button variant="outline" size="sm">
                      <MapPin className="h-4 w-4 mr-2" />
                      My Location
                    </Button>
                  </Link>
                  <Link href="/community/map/submit">
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Place
                    </Button>
                  </Link>
                </>
              ) : (
                <Link href="/login?redirect=/community/map">
                  <Button size="sm">
                    Sign in to add places
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="container max-w-6xl py-6">
        <ReaderMap />

        {/* Info Section */}
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="font-medium">Readers</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Fellow book lovers who have opted in to share their approximate location.
            </p>
          </div>

          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="font-medium">Bookstores</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Local bookshops and book retailers from OpenStreetMap data.
            </p>
          </div>

          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="font-medium">Libraries</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Public libraries and reading spaces in your area.
            </p>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="mt-6 p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Privacy First</p>
          <p>
            Reader locations are always approximate (~1-20km accuracy). Your exact coordinates are never stored or shared.
            You can enable or disable location sharing at any time in your{" "}
            <Link href="/settings" className="text-primary hover:underline">
              settings
            </Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

