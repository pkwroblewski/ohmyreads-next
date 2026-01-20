import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllGenres } from "@/lib/queries/books";
import { getTasteProfile } from "@/lib/actions/taste";
import { TasteOnboardingWizard } from "@/components/onboarding/taste-onboarding-wizard";

export const metadata: Metadata = {
  title: "Set Up Your Taste Profile",
  description: "Help us understand your reading preferences to get personalized book recommendations",
  robots: { index: false, follow: false },
};

// Fallback genres
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

export default async function TasteOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/onboarding/taste");
  }

  // Check if user already completed onboarding
  const { profile: existingProfile } = await getTasteProfile();
  
  // If already completed, redirect to dashboard with a note
  if (existingProfile?.onboarding_completed) {
    redirect("/dashboard");
  }

  // Fetch genres
  const genres = await getAllGenres();
  const availableGenres = genres.length > 0 ? genres : FALLBACK_GENRES;

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-8 px-4">
      <TasteOnboardingWizard
        availableGenres={availableGenres}
        existingProfile={existingProfile}
      />
    </div>
  );
}

