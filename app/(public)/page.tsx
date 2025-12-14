import Link from "next/link";
import type { Metadata } from "next";
import {
  BookOpen,
  PenLine,
  BarChart3,
  Users,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HomeHero } from "@/components/home/home-hero";
import { HomeFeed } from "@/components/home/home-feed";
import { CommunityFeed } from "@/components/home/community-feed";
import {
  getCuratedBooks,
  getTrendingGlobally,
} from "@/lib/queries/recommendations";
import {
  getHomeReadingActivity,
  getCommunityFeed,
} from "@/lib/queries/home";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "OhMyReads - Track Your Reading Journey",
  description:
    "Discover books, write reviews, and connect with fellow readers. The modern way to track and share your reading life.",
  keywords: [
    "book tracking",
    "reading",
    "book reviews",
    "goodreads alternative",
    "reading list",
  ],
  openGraph: {
    title: "OhMyReads - Track Your Reading Journey",
    description:
      "Discover books, write reviews, and connect with fellow readers.",
    type: "website",
  },
};

const features = [
  {
    icon: BookOpen,
    title: "Track Your Books",
    description:
      "Organize with custom shelves: Want to Read, Currently Reading, and Read",
  },
  {
    icon: PenLine,
    title: "Write Reviews",
    description:
      "Share your thoughts and help others discover great books",
  },
  {
    icon: BarChart3,
    title: "Reading Stats",
    description:
      "Track your progress with beautiful stats and reading streaks",
  },
  {
    icon: Users,
    title: "Connect with Readers",
    description: "Follow friends and see what they're reading",
  },
];

export default async function HomePage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ohmyreads.com";

  // Get user if logged in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch all data in parallel
  const [curatedBooks, trendingBooks, activity, communityFeed] =
    await Promise.all([
      getCuratedBooks(user?.id, 4), // Only need 4 for mini grid
      getTrendingGlobally(5), // 5 for trending list
      user ? getHomeReadingActivity(user.id) : Promise.resolve(null),
      getCommunityFeed(6), // 6 recent reviews
    ]);

  return (
    <div className="flex flex-col">
      {/* Organization JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "OhMyReads",
            url: siteUrl,
            logo: `${siteUrl}/logo.png`,
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
          __html: JSON.stringify({
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
      <HomeHero isLoggedIn={!!user} />

      {/* ========================================
          3-PANEL FEED SECTION
          ======================================== */}
      <HomeFeed
        activity={activity}
        curatedBooks={curatedBooks}
        trendingBooks={trendingBooks}
        isLoggedIn={!!user}
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
              Everything you need to track your reading
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Simple, powerful tools to organize your books and connect with readers.
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
                  "bg-card/80 backdrop-blur-sm hover:shadow-md",
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
                    <feature.icon className="w-4 h-4" />
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
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-accent/90" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl mx-auto text-center">
            {/* Heading */}
            <h2 className="text-xl sm:text-2xl font-bold font-serif mb-2 text-primary-foreground">
              Ready to start your reading journey?
            </h2>
            
            {/* Subheading */}
            <p className="text-sm text-primary-foreground/80 mb-5">
              Join thousands of readers tracking their books on OhMyReads.
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
                Create Free Account
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            
            {/* Small text */}
            <p className="text-xs text-primary-foreground/60 mt-2">
              No credit card required
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
