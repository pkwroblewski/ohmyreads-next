import Link from "next/link";
import type { Metadata } from "next";
import {
  BookOpen,
  PenLine,
  BarChart3,
  Users,
  Star,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HomeHero } from "@/components/home/home-hero";
import { HomeFeed } from "@/components/home/home-feed";
import {
  getCuratedBooks,
  getTrendingOnPlatform,
  getTrendingGlobally,
} from "@/lib/queries/recommendations";
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

  // Fetch all recommendations in parallel
  const [curatedBooks, trendingPlatform, trendingGlobal] = await Promise.all([
    getCuratedBooks(user?.id, 10),
    getTrendingOnPlatform(10),
    getTrendingGlobally(8),
  ]);

  const hasBooks =
    curatedBooks.length > 0 ||
    trendingPlatform.length > 0 ||
    trendingGlobal.length > 0;

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
          BOOK FEED SECTION - Two-column layout
          ======================================== */}
      {hasBooks && (
        <HomeFeed
          curatedBooks={curatedBooks}
          trendingPlatform={trendingPlatform}
          trendingGlobal={trendingGlobal}
          isLoggedIn={!!user}
        />
      )}

      {/* ========================================
          FEATURES SECTION
          ======================================== */}
      <section className="py-12 lg:py-16 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-3">
              Everything you need to track your reading
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Simple, powerful tools to organize your books and connect with readers.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <CardContent className="p-5">
                  {/* Icon */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center mb-3",
                      "transition-colors duration-300",
                      "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                    )}
                  >
                    <feature.icon className="w-5 h-5" />
                  </div>
                  
                  {/* Content */}
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================
          CTA SECTION - Lighter
          ======================================== */}
      <section className="py-12 lg:py-16 relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-accent/90" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            {/* Heading */}
            <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-3 text-primary-foreground">
              Ready to start your reading journey?
            </h2>
            
            {/* Subheading */}
            <p className="text-primary-foreground/80 mb-6">
              Join thousands of readers tracking their books on OhMyReads.
            </p>
            
            {/* CTA Button */}
            <Link href="/signup">
              <Button
                size="lg"
                className={cn(
                  "text-base px-6",
                  "bg-white text-primary hover:bg-white/90",
                  "dark:bg-background dark:text-foreground dark:hover:bg-background/90"
                )}
              >
                Create Free Account
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            
            {/* Small text */}
            <p className="text-xs text-primary-foreground/60 mt-3">
              No credit card required
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
