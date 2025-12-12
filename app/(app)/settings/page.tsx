import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllGenres } from "@/lib/queries/books";
import { getTasteProfile } from "@/lib/actions/taste";
import { TasteProfileSection } from "@/components/settings/taste-profile-section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Settings | OhMyReads",
  description: "Manage your OhMyReads account settings and preferences",
  robots: { index: false, follow: false },
};

// Fallback genres if database returns empty
const FALLBACK_GENRES = [
  "Fiction",
  "Non-Fiction",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Fantasy",
  "Thriller",
  "Horror",
  "Biography",
  "History",
  "Self-Help",
  "Business",
  "Science",
  "Philosophy",
  "Poetry",
  "Drama",
  "Young Adult",
  "Children",
];

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/settings");
  }

  // Fetch genres and taste profile in parallel
  const [genres, { profile: tasteProfile }] = await Promise.all([
    getAllGenres(),
    getTasteProfile(),
  ]);

  const availableGenres = genres.length > 0 ? genres : FALLBACK_GENRES;

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and reading preferences
          </p>
        </div>
      </div>

      {/* Taste Profile Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <CardTitle>Taste Profile</CardTitle>
          </div>
          <CardDescription>
            Help us recommend books you&apos;ll love by sharing your reading preferences.
            This data is used to personalize your recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TasteProfileSection
            initialProfile={tasteProfile}
            availableGenres={availableGenres}
          />
        </CardContent>
      </Card>

      {/* Account Settings Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Manage your account settings and profile information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Account settings coming soon. Visit your{" "}
            <a href="/profile" className="text-primary underline-offset-4 hover:underline">
              profile page
            </a>{" "}
            to update your display name and bio.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
