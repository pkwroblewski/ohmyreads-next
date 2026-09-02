import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { getAllGenres } from "@/lib/queries/books";
import { getTasteProfile } from "@/lib/actions/taste";
import { getUserLocation } from "@/lib/queries/geo";
import { getDiscoveryVisibility, getEmailPreferences } from "@/lib/actions/privacy";
import { TasteProfileSection } from "@/components/settings/taste-profile-section";
import { LocationSection } from "@/components/settings/location-section";
import { PrivacySection } from "@/components/settings/privacy-section";
import { EmailSection } from "@/components/settings/email-section";
import { ExportSection } from "@/components/settings/export-section";
import { AccountSection } from "@/components/settings/account-section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Sparkles, MapPin, Download, Shield, Mail, UserCog } from "lucide-react";

export const metadata: Metadata = {
  title: "Settings",
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
  const {
    data: { user },
  } = await getUser();

  if (!user) {
    redirect("/login?redirect=/settings");
  }

  const supabase = await createClient();

  // Fetch genres, taste profile, location, privacy settings and username in parallel
  const [
    genres,
    { profile: tasteProfile },
    userLocation,
    discoveryVisible,
    emailPreferences,
    { data: profile },
  ] = await Promise.all([
    getAllGenres(),
    getTasteProfile(),
    getUserLocation(user.id),
    getDiscoveryVisibility(),
    getEmailPreferences(),
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
  ]);

  const username = profile?.username ?? "";
  const hasPassword = user.identities?.some((identity) => identity.provider === "email") ?? false;

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

      {/* Location Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <CardTitle>Location</CardTitle>
          </div>
          <CardDescription>
            Share your approximate location to discover nearby readers and book-friendly places.
            Your exact coordinates are never stored or shared.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LocationSection initialLocation={userLocation} />
        </CardContent>
      </Card>

      {/* Privacy Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Privacy</CardTitle>
          </div>
          <CardDescription>
            Control how you appear to other readers on the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PrivacySection initialDiscoveryVisible={discoveryVisible} />
        </CardContent>
      </Card>

      {/* Email Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle>Email</CardTitle>
          </div>
          <CardDescription>
            Choose which emails OhMyReads sends you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailSection initialDigestEnabled={emailPreferences.digestEnabled} />
        </CardContent>
      </Card>

      {/* Data Export Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            <CardTitle>Export Your Data</CardTitle>
          </div>
          <CardDescription>
            Download a copy of all your reading data. Includes your books,
            reviews, challenges, and social connections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportSection />
        </CardContent>
      </Card>

      {/* Account Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            <CardTitle>Account</CardTitle>
          </div>
          <CardDescription>
            Change your password or delete your account. Display name and bio live on your{" "}
            <a href="/profile" className="text-primary underline-offset-4 hover:underline">
              profile page
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountSection username={username} email={user.email ?? null} hasPassword={hasPassword} />
        </CardContent>
      </Card>
    </div>
  );
}
