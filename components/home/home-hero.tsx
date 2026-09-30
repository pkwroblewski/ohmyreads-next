import Link from "next/link";
import { ArrowRight, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shelf, type ShelfBook } from "@/components/shelf/shelf";
import { ShelfStarter } from "@/components/home/shelf-starter";

interface HomeHeroProps {
  isLoggedIn?: boolean;
  /** The hand-picked staff shelf (`lib/curated-picks.ts`). */
  staffShelf: ShelfBook[];
}

export function HomeHero({ isLoggedIn, staffShelf }: HomeHeroProps) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-8 sm:pt-14 lg:pt-16">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl xl:text-6xl font-semibold tracking-tight mb-4">
            Every book you&apos;ve read,{" "}
            <span className="font-serif italic font-normal">on one shelf.</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mb-6">
            Start with one book you loved, or bring your whole Goodreads history.
            Independent, and your data is yours to export any time.
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-3">
            {isLoggedIn ? (
              <>
                <Link href="/profile">
                  <Button size="lg" className="text-base px-6">
                    Go to your shelf
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/books">
                  <Button variant="outline" size="lg" className="text-base px-6">
                    Browse books
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/signup">
                  <Button size="lg" className="text-base px-6">
                    Build your shelf
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/login?redirect=/import">
                  <Button variant="outline" size="lg" className="text-base px-6">
                    <Upload className="w-4 h-4 mr-2" />
                    Bring your Goodreads shelf
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {!isLoggedIn && <ShelfStarter />}
      </div>

      {staffShelf.length > 0 && (
        <div className="mt-10">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Staff shelf
          </p>
          <p className="mb-2 text-sm text-muted-foreground">
            Picked by hand, not by an algorithm. Point at a spine to see the book.
          </p>
          <Shelf books={staffShelf} label="Staff shelf" leanLast listView={false} />
        </div>
      )}
    </section>
  );
}
