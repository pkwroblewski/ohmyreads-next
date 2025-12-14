import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BookOpen, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HomeHeroProps {
  isLoggedIn?: boolean;
}

export function HomeHero({ isLoggedIn }: HomeHeroProps) {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle background - warm, cozy feel */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50/80 via-orange-50/50 to-transparent dark:from-primary/5 dark:via-accent/5 dark:to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left: Text content */}
          <div className="text-center lg:text-left">
            {/* Heading */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              Find Your Next{" "}
              <span className="font-serif italic text-primary">
                Great Read
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0 mb-6">
              Discover books, track your reading, write reviews, and connect
              with readers who love the same stories.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              {isLoggedIn ? (
                <Link href="/dashboard">
                  <Button size="lg" className="w-full sm:w-auto text-base px-6">
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              ) : (
                <Link href="/signup">
                  <Button size="lg" className="w-full sm:w-auto text-base px-6">
                    Get Started Free
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              )}
              <Link href="/books">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto text-base px-6"
                >
                  Browse Books
                </Button>
              </Link>
            </div>

            {/* Quick stats - social proof */}
            <div className="flex items-center justify-center lg:justify-start gap-6 mt-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-primary" />
                <span>10k+ Books</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-accent" />
                <span>5k+ Reviews</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                <span>2k+ Readers</span>
              </div>
            </div>
          </div>

          {/* Right: Hero Image */}
          <div className="hidden lg:block">
            <div className="relative">
              {/* Image container with subtle styling */}
              <div
                className={cn(
                  "relative w-full aspect-[4/3] max-w-lg mx-auto",
                  "rounded-2xl overflow-hidden",
                  "shadow-2xl shadow-primary/10",
                  "ring-1 ring-black/5 dark:ring-white/10"
                )}
              >
                <Image
                  src="/images/Gemini_Generated_Image_sdr5ejsdr5ejsdr5.png"
                  alt="A cozy reading scene with OhMyReads on a tablet"
                  fill
                  priority
                  quality={90}
                  className="object-cover"
                  sizes="(max-width: 1024px) 0px, 512px"
                />

                {/* Subtle overlay for dark mode consistency */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent dark:from-black/20" />
              </div>

              {/* Decorative elements around the image */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-primary/10 rounded-full blur-xl" />
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-accent/10 rounded-full blur-xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
