import Link from "next/link";
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
      
      {/* Decorative book shapes (subtle) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-[10%] w-24 h-32 bg-primary/5 dark:bg-primary/10 rounded-sm rotate-12 blur-sm" />
        <div className="absolute bottom-10 left-[5%] w-20 h-28 bg-accent/5 dark:bg-accent/10 rounded-sm -rotate-6 blur-sm" />
        <div className="absolute top-1/2 right-[25%] w-16 h-24 bg-amber-200/20 dark:bg-amber-500/5 rounded-sm rotate-3 blur-sm" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
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

          {/* Right: Illustrated book collage */}
          <div className="hidden lg:block">
            <div className="relative">
              {/* Cozy reading illustration using CSS shapes */}
              <div className="relative w-full aspect-[4/3] max-w-md mx-auto">
                {/* Background shape - bookshelf silhouette */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-50 dark:from-primary/10 dark:to-accent/5 border border-amber-200/50 dark:border-primary/20" />
                
                {/* Stacked books illustration */}
                <div className="absolute bottom-8 left-8 flex gap-2">
                  {/* Book 1 */}
                  <div className={cn(
                    "w-12 h-40 rounded-sm shadow-lg transform -rotate-3",
                    "bg-gradient-to-b from-rose-400 to-rose-500"
                  )} />
                  {/* Book 2 */}
                  <div className={cn(
                    "w-14 h-44 rounded-sm shadow-lg transform rotate-2",
                    "bg-gradient-to-b from-amber-400 to-amber-500"
                  )} />
                  {/* Book 3 */}
                  <div className={cn(
                    "w-12 h-36 rounded-sm shadow-lg transform -rotate-1",
                    "bg-gradient-to-b from-emerald-400 to-emerald-500"
                  )} />
                  {/* Book 4 */}
                  <div className={cn(
                    "w-14 h-48 rounded-sm shadow-lg transform rotate-1",
                    "bg-gradient-to-b from-sky-400 to-sky-500"
                  )} />
                  {/* Book 5 */}
                  <div className={cn(
                    "w-12 h-38 rounded-sm shadow-lg transform -rotate-2",
                    "bg-gradient-to-b from-violet-400 to-violet-500"
                  )} />
                </div>

                {/* Coffee cup */}
                <div className="absolute bottom-6 right-12">
                  <div className="w-10 h-8 rounded-b-full bg-amber-100 dark:bg-amber-900/50 border-2 border-amber-300 dark:border-amber-700" />
                  <div className="absolute -right-2 top-1 w-4 h-5 border-2 border-amber-300 dark:border-amber-700 rounded-r-full bg-transparent" />
                </div>

                {/* Reading glasses */}
                <div className="absolute top-8 right-8">
                  <div className="flex gap-1">
                    <div className="w-8 h-6 rounded-full border-2 border-gray-400 dark:border-gray-600" />
                    <div className="w-8 h-6 rounded-full border-2 border-gray-400 dark:border-gray-600" />
                  </div>
                  <div className="w-16 h-0.5 bg-gray-400 dark:bg-gray-600 -mt-3" />
                </div>

                {/* Plant */}
                <div className="absolute top-6 left-6">
                  <div className="w-8 h-10 rounded-b-lg bg-terracotta-400 dark:bg-amber-800" style={{ backgroundColor: '#c4a77d' }} />
                  <div className="absolute -top-4 left-1 w-2 h-6 bg-emerald-500 rounded-full transform -rotate-12" />
                  <div className="absolute -top-5 left-3 w-2 h-7 bg-emerald-400 rounded-full" />
                  <div className="absolute -top-4 left-5 w-2 h-5 bg-emerald-600 rounded-full transform rotate-12" />
                </div>

                {/* Floating star ratings */}
                <div className="absolute top-16 right-20 flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "w-3 h-3",
                        i < 4 ? "fill-accent text-accent" : "text-muted-foreground"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

