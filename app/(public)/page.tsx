import Link from "next/link";
import type { Metadata } from "next";
import {
  BookOpen,
  PenLine,
  BarChart3,
  Users,
  Star,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookRecommendationRow } from "@/components/books/book-recommendation-row";
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

const stats = [
  { value: "10,000+", label: "Books", icon: BookOpen },
  { value: "5,000+", label: "Reviews", icon: Star },
  { value: "2,000+", label: "Readers", icon: Users },
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
    getCuratedBooks(user?.id, 12),
    getTrendingOnPlatform(12),
    getTrendingGlobally(12),
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
          HERO SECTION
          ======================================== */}
      <section className="relative overflow-hidden">
        {/* Background Effects */}
        {/* Light mode: subtle warm gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent dark:opacity-0" />
        
        {/* Dark mode: animated gradient orbs */}
        <div className="absolute inset-0 opacity-0 dark:opacity-100">
          <div className="absolute top-1/4 -left-20 w-72 h-72 bg-primary/30 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-accent/20 rounded-full blur-[120px] animate-pulse delay-1000" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 border border-primary/20">
              <Sparkles className="w-4 h-4" />
              <span>The modern way to track your reading</span>
            </div>

            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Track Your{" "}
              <span className="font-serif italic text-primary dark:bg-gradient-to-r dark:from-primary dark:to-accent dark:bg-clip-text dark:text-transparent">
                Reading
              </span>{" "}
              Journey
            </h1>

            {/* Subheading */}
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Discover new books, share reviews, and connect with readers who
              love the same stories you do.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto text-base px-8 shadow-lg shadow-primary/25">
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/books">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto text-base px-8"
                >
                  Browse Books
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          BOOK RECOMMENDATIONS SECTION
          ======================================== */}
      {hasBooks && (
        <section className="py-12 lg:py-16">
          <div className="mx-auto max-w-7xl space-y-12">
            {/* Curated for You */}
            {curatedBooks.length > 0 && (
              <BookRecommendationRow
                title="Curated for You"
                subtitle={
                  user
                    ? "Based on your reading history"
                    : "Popular highly-rated books"
                }
                books={curatedBooks}
                viewAllHref="/books"
              />
            )}

            {/* Trending on OhMyReads */}
            {trendingPlatform.length > 0 && (
              <BookRecommendationRow
                title="Trending on OhMyReads"
                subtitle="What readers are adding to their shelves"
                books={trendingPlatform}
                viewAllHref="/books?sort=trending"
              />
            )}

            {/* Trending Globally */}
            {trendingGlobal.length > 0 && (
              <BookRecommendationRow
                title="Trending Globally"
                subtitle="Most popular books worldwide"
                books={trendingGlobal}
                viewAllHref="/books?sort=popular"
              />
            )}
          </div>
        </section>
      )}

      {/* ========================================
          FEATURES SECTION
          ======================================== */}
      <section className="py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">
              Everything you need to track your reading
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Simple, powerful tools to organize your books and connect with readers.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className={cn(
                  "group relative overflow-hidden",
                  "transition-all duration-300",
                  // Light mode
                  "bg-card hover:shadow-warm-lg",
                  // Dark mode
                  "dark:bg-card/50 dark:backdrop-blur-sm",
                  "dark:hover:border-primary/50 dark:hover:shadow-[0_0_30px_rgba(139,92,246,0.1)]"
                )}
              >
                <CardContent className="p-6">
                  {/* Icon */}
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                      "transition-colors duration-300",
                      // Light mode
                      "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
                      // Dark mode
                      "dark:bg-primary/20 dark:text-primary dark:group-hover:bg-primary"
                    )}
                  >
                    <feature.icon className="w-6 h-6" />
                  </div>
                  
                  {/* Content */}
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
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
          STATS SECTION
          ======================================== */}
      <section className="py-20 lg:py-24 bg-muted/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={cn(
                  "text-center py-8",
                  // Dividers on desktop
                  index !== stats.length - 1 && "md:border-r md:border-border"
                )}
              >
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 text-accent mb-4">
                  <stat.icon className="w-7 h-7" />
                </div>
                
                {/* Value */}
                <div className="text-4xl sm:text-5xl font-bold font-serif mb-2">
                  {stat.value}
                </div>
                
                {/* Label */}
                <div className="text-muted-foreground font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================
          CTA SECTION
          ======================================== */}
      <section className="py-20 lg:py-24 relative overflow-hidden">
        {/* Gradient Background */}
        {/* Light mode: warm gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent dark:opacity-0" />
        
        {/* Dark mode: violet/cyan gradient */}
        <div className="absolute inset-0 opacity-0 dark:opacity-100 bg-gradient-to-br from-primary via-primary/80 to-accent" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            {/* Heading */}
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4 text-primary-foreground">
              Ready to start your reading journey?
            </h2>
            
            {/* Subheading */}
            <p className="text-lg text-primary-foreground/80 mb-8">
              Join thousands of readers tracking their books on OhMyReads.
            </p>
            
            {/* CTA Button */}
            <Link href="/signup">
              <Button
                size="lg"
                className={cn(
                  "text-base px-8",
                  // Inverted colors for contrast
                  "bg-white text-primary hover:bg-white/90",
                  "dark:bg-background dark:text-foreground dark:hover:bg-background/90",
                  "shadow-lg"
                )}
              >
                Create Free Account
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            
            {/* Small text */}
            <p className="text-sm text-primary-foreground/60 mt-4">
              No credit card required
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

