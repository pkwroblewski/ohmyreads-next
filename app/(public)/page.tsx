import Link from "next/link";
import type { Metadata } from "next";
import {
  Library,
  CalendarDays,
  Upload,
  Download,
  ArrowRight,
} from "lucide-react";
import { getUser } from "@/lib/supabase/server";
import {
  getCachedTrendingInsights,
  type TrendingInsight,
} from "@/lib/ai/trending-insights";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HomeHero } from "@/components/home/home-hero";
import { HomeFeed } from "@/components/home/home-feed";
import { CommunityFeed } from "@/components/home/community-feed";
import {
  getCuratedBooks,
  getTrulyTrending,
} from "@/lib/queries/recommendations";
import {
  getHomeReadingActivity,
  getCommunityFeed,
} from "@/lib/queries/home";
import { getStaffShelf } from "@/lib/queries/shelf";
import { STAFF_PICK_REASON } from "@/lib/curated-picks";
import { cn } from "@/lib/utils";
import { safeJsonLd } from "@/lib/utils/jsonld";

export const metadata: Metadata = {
  // `absolute` opts out of the layout's "%s | OhMyReads" template, which would
  // otherwise print the brand twice on the one page that names itself.
  title: { absolute: "OhMyReads - Every book you've read, on one shelf" },
  alternates: { canonical: "/" },
  description:
    "The independent reading community where you own your data and readers come first. Track your reading journey without corporate interference.",
  keywords: [
    "book tracking",
    "reading community",
    "book reviews",
    "goodreads alternative",
    "independent book platform",
    "book recommendations",
    "reading list",
  ],
  openGraph: {
    title: "OhMyReads - Every book you've read, on one shelf",
    description:
      "The independent reading community where you own your data and readers come first.",
    type: "website",
  },
};

const features = [
  {
    icon: Library,
    title: "Every book, spine out",
    description:
      "Finish a book and it goes on your shelf: as wide as its page count, in the colours of its cover.",
  },
  {
    icon: CalendarDays,
    title: "One shelf per year",
    description:
      "Your reading year by year, with the month under each book and the pages on every shelf.",
  },
  {
    icon: Upload,
    title: "Bring your Goodreads years",
    description:
      "Upload your Goodreads export and every book you've logged appears on your shelves at once.",
  },
  {
    icon: Download,
    title: "Yours to take with you",
    description:
      "Independent and reader-owned. Export your books as CSV or JSON whenever you like.",
  },
];

export default async function HomePage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ohmyreads.com";

  // Get user if logged in
  const {
    data: { user },
  } = await getUser();

  // Fetch all data in parallel
  const [curatedBooks, trendingBooks, activity, communityFeed, staffShelf] =
    await Promise.all([
      getCuratedBooks(user?.id, 4), // Only need 4 for mini grid
      getTrulyTrending(7, 7), // 7 books, 7-day window for real trending
      user ? getHomeReadingActivity(user.id) : Promise.resolve(null),
      getCommunityFeed(6), // 6 recent reviews
      getStaffShelf(),
    ]);

  // Not awaited: the trending panel streams it in (see HomeFeed). Signed-in
  // readers only — the entry is one LLM generation per day for the whole
  // site, and it used to be a client fetch that anonymous visitors paid for
  // as a guaranteed 401.
  const trendingInsights: Promise<TrendingInsight[]> = user
    ? getCachedTrendingInsights().catch(() => [])
    : Promise.resolve([]);

  return (
    <div className="flex flex-col">
      {/* Organization JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "OhMyReads",
            url: siteUrl,
            logo: `${siteUrl}/icons/icon-512`,
            sameAs: [],
            description:
              "Discover books, write reviews, and connect with fellow readers.",
          }),
        }}
      />

      {/* WebSite JSON-LD with SearchAction */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "OhMyReads",
            url: siteUrl,
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${siteUrl}/books?q={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
          }),
        }}
      />

      {/* ========================================
          HERO SECTION - Smaller, bookish
          ======================================== */}
      <HomeHero isLoggedIn={!!user} staffShelf={staffShelf} />

      {/* ========================================
          3-PANEL FEED SECTION
          ======================================== */}
      <HomeFeed
        activity={activity}
        curatedBooks={curatedBooks}
        trendingBooks={trendingBooks}
        trendingInsights={trendingInsights}
        isLoggedIn={!!user}
        // A reader without taste signals gets the staff picks too; only
        // call the panel personal when it is.
        personalised={curatedBooks.some((b) => b.reason.label !== STAFF_PICK_REASON)}
      />

      {/* ========================================
          COMMUNITY FEED SECTION
          ======================================== */}
      {communityFeed.length > 0 && (
        <CommunityFeed items={communityFeed} title="Community Feed" />
      )}

      {/* ========================================
          FEATURES SECTION
          ======================================== */}
      <section className="py-12 lg:py-14 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold font-serif mb-2">
              Your reading life, as a shelf
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              It looks right with one book and better with a thousand. Nobody else needs to be here for yours to fill up.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className={cn(
                  "group relative overflow-hidden",
                  "transition-all duration-300",
                  "bg-card/80 backdrop-blur-sm",
                  "shadow-sm hover:shadow-md",
                  "dark:bg-card/50",
                  "dark:hover:border-primary/30"
                )}
              >
                <CardContent className="p-4">
                  {/* Icon */}
                  <div
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center mb-2",
                      "transition-colors duration-300",
                      "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                    )}
                  >
                    <feature.icon className="w-5 h-5" strokeWidth={1.75} />
                  </div>

                  {/* Content */}
                  <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================
          CTA SECTION - Compact
          ======================================== */}
      <section className="py-10 lg:py-12 relative overflow-hidden">
        {/* Ribbon band */}
        <div className="absolute inset-0 bg-primary" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl mx-auto text-center">
            {/* Heading */}
            <h2 className="text-xl sm:text-2xl font-bold font-serif mb-2 text-primary-foreground">
              What was the last book you loved?
            </h2>

            {/* Subheading */}
            <p className="text-sm text-primary-foreground mb-5">
              Put it on the first shelf. The rest can come later, or all at once from Goodreads.
            </p>

            {/* CTA Button */}
            <Link href="/signup">
              <Button
                size="default"
                className={cn(
                  "text-sm px-6",
                  "bg-white text-primary hover:bg-white/90",
                  "dark:bg-background dark:text-foreground dark:hover:bg-background/90"
                )}
              >
                Build your shelf
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>

            {/* Small text */}
            <p className="text-xs text-primary-foreground mt-2">
              No credit card required
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
