import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BookOpen, Users, Sparkles, Shield, Building2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HomeHeroProps {
  isLoggedIn?: boolean;
  readerCount?: number;
  reviewCount?: number;
}

// Below this, numeric social proof reads as small — show qualitative copy instead
const COUNT_DISPLAY_THRESHOLD = 1000;

function formatCount(count: number): string {
  if (count >= 1000) {
    const thousands = count / 1000;
    return `${thousands >= 10 ? Math.floor(thousands) : (Math.floor(thousands * 10) / 10).toString().replace(/\.0$/, "")}k+`;
  }
  return String(count);
}

export function HomeHero({
  isLoggedIn,
  readerCount = 0,
  reviewCount = 0,
}: HomeHeroProps) {
  const showCounts =
    readerCount >= COUNT_DISPLAY_THRESHOLD ||
    reviewCount >= COUNT_DISPLAY_THRESHOLD;

  return (
    <section className="relative min-h-[500px] sm:min-h-[550px] lg:min-h-[600px] overflow-hidden">
      {/* Full-width background image */}
      <div className="absolute inset-0">
        <Image
          src="/images/Gemini_Generated_Image_sdr5ejsdr5ejsdr5.png"
          alt="Cozy reading atmosphere"
          fill
          priority
          quality={90}
          className="object-cover object-center lg:object-right"
          sizes="100vw"
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgEDAwUBAAAAAAAAAAAAAQIDAAQRBSExBhITQWFx/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAYEQEBAQEBAAAAAAAAAAAAAAABAgADEf/aAAwDAQACEQMRAD8AyrT9V1G2s4reC9njgiQJGiyEBVAwAPgqtSlMZdzOf//Z"
        />

        {/* Gradient fade: opaque warm background on left, transparent on right to reveal image */}
        {/* Base layer - ensures text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 via-40% to-transparent" />

        {/* Warm amber mist overlay for cozy feel (light mode) */}
        <div className="absolute inset-0 bg-gradient-to-r from-amber-50/90 via-amber-50/60 via-35% to-transparent dark:from-transparent dark:via-transparent dark:to-transparent" />

        {/* Dark mode: subtle dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 via-45% to-background/20 dark:block hidden" />

        {/* Subtle vignette on the visible image area */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/30 via-transparent to-transparent" />
      </div>

      {/* Content overlay */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <div className="max-w-xl lg:max-w-2xl">
          {/* Why OhMyReads - Elevated differentiators */}
          <div className="flex flex-wrap gap-2 sm:gap-3 mb-6">
            <div className="flex items-center gap-2 bg-primary/10 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-full border border-primary/20">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Independent & reader-owned</span>
            </div>
            <div className="flex items-center gap-2 bg-primary/10 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-full border border-primary/20">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Your data stays yours</span>
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight mb-4 lg:mb-6">
            <span className="font-serif italic text-primary">
              Independent Minds,
            </span>{" "}
            Shared Stories
          </h1>

          {/* Subheading */}
          <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-lg mb-6 lg:mb-8">
            The reading community where books come first. Discover your next
            favorite through real reader recommendations, not algorithms.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-start gap-3 mb-6">
            {isLoggedIn ? (
              <Link href="/dashboard">
                <Button size="lg" className="text-base px-6 shadow-lg shadow-primary/20">
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/signup">
                  <Button size="lg" className="text-base px-6 shadow-lg shadow-primary/20">
                    Get Started Free
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/login?redirect=/import">
                  <Button
                    variant="outline"
                    size="lg"
                    className="text-base px-6 bg-background/80 backdrop-blur-sm hover:bg-background"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Import from Goodreads
                  </Button>
                </Link>
              </>
            )}
            {isLoggedIn && (
              <Link href="/books">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-base px-6 bg-background/80 backdrop-blur-sm hover:bg-background"
                >
                  Browse Books
                </Button>
              </Link>
            )}
          </div>

          {/* Social proof and features */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-muted-foreground">
            {showCounts ? (
              <>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-primary" />
                  <span>
                    <strong className="text-foreground">
                      {formatCount(readerCount)}
                    </strong>{" "}
                    readers
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span>
                    <strong className="text-foreground">
                      {formatCount(reviewCount)}
                    </strong>{" "}
                    reviews
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                <span>A growing community of readers</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Smart recommendations</span>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative blur elements */}
      <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-10 w-24 h-24 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
    </section>
  );
}
