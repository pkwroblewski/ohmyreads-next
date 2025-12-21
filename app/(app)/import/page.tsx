import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GoodreadsImport } from "@/components/import/goodreads-import";
import { Upload } from "lucide-react";

export const metadata: Metadata = {
  title: "Import Books | OhMyReads",
  description: "Import your reading history from Goodreads to OhMyReads",
  robots: { index: false, follow: false },
};

export default async function ImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/import");
  }

  return (
    <div className="container max-w-2xl py-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10">
          <Upload className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Import Books</h1>
          <p className="text-muted-foreground">
            Bring your reading history from other platforms
          </p>
        </div>
      </div>

      {/* Goodreads Import Card */}
      <Card>
        <CardHeader>
          <CardTitle>Import from Goodreads</CardTitle>
          <CardDescription>
            Upload your Goodreads library export to import your books, ratings,
            and reading status. Books that exist in our catalog will be matched
            automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GoodreadsImport />
        </CardContent>
      </Card>

      {/* Future Import Options */}
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="text-base">More import options coming soon</CardTitle>
          <CardDescription>
            We&apos;re working on support for StoryGraph, LibraryThing, and manual CSV imports.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
