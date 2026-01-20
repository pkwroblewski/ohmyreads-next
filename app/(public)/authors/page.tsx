import { Metadata } from "next";
import Link from "next/link";
import { Users, BookOpen, Star } from "lucide-react";
import { getAllAuthors } from "@/lib/queries/authors";

export const metadata: Metadata = {
  title: "Authors",
  description:
    "Browse authors on OhMyReads. Discover books by your favorite authors and find new writers to explore.",
  openGraph: {
    title: "Authors",
    description: "Browse authors and discover their books on OhMyReads.",
  },
};

export default async function AuthorsPage() {
  const authors = await getAllAuthors();

  // Group authors by first letter
  const grouped = new Map<string, typeof authors>();
  for (const author of authors) {
    const firstLetter = author.name.charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(firstLetter) ? firstLetter : "#";

    if (!grouped.has(letter)) {
      grouped.set(letter, []);
    }
    grouped.get(letter)!.push(author);
  }

  // Sort letters
  const letters = Array.from(grouped.keys()).sort((a, b) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="container max-w-6xl py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-lg bg-primary/10">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-serif">Authors</h1>
          <p className="text-muted-foreground">
            {authors.length} authors in our catalog
          </p>
        </div>
      </div>

      {/* Letter Navigation */}
      <nav className="flex flex-wrap gap-2 mb-8 p-4 bg-muted/50 rounded-lg">
        {letters.map((letter) => (
          <a
            key={letter}
            href={`#${letter}`}
            className="w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            {letter}
          </a>
        ))}
      </nav>

      {/* Authors List */}
      <div className="space-y-12">
        {letters.map((letter) => {
          const letterAuthors = grouped.get(letter) || [];
          return (
            <section key={letter} id={letter}>
              <h2 className="text-xl font-bold font-serif mb-4 pb-2 border-b sticky top-0 bg-background z-10">
                {letter}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {letterAuthors.map((author) => (
                  <Link
                    key={author.slug}
                    href={`/authors/${author.slug}`}
                    className="group p-4 rounded-lg border bg-card hover:border-primary/50 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                          {author.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5" />
                            {author.bookCount} {author.bookCount === 1 ? "book" : "books"}
                          </span>
                          {author.avgRating && (
                            <span className="flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              {author.avgRating}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
