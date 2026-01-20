import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlaceSubmissionForm } from "@/components/geo/place-submission-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Submit a Place",
  description: "Submit a book-friendly place to the OhMyReads community map.",
};

export default async function SubmitPlacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/community/map/submit");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container max-w-2xl py-6">
          <div className="flex items-center gap-4">
            <Link href="/community/map">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-serif">Add a Place</h1>
                <p className="text-muted-foreground text-sm">
                  Share a book-friendly spot with the community
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="container max-w-2xl py-8">
        <PlaceSubmissionForm />
      </div>
    </div>
  );
}

