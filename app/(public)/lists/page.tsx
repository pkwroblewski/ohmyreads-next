import { Metadata } from "next";
import Link from "next/link";
import { Library } from "lucide-react";
import { CURATED_LISTS } from "@/lib/data/curated-lists";

export const metadata: Metadata = {
  title: "Reading Lists | OhMyReads",
  description:
    "Curated reading lists to help you find your next favorite book. Browse by genre, theme, or mood.",
  openGraph: {
    title: "Curated Reading Lists | OhMyReads",
    description: "Find your next great read with our handpicked book collections.",
  },
};

export default function ListsPage() {
  return (
    <div className="container max-w-6xl py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-lg bg-primary/10">
          <Library className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-serif">Reading Lists</h1>
          <p className="text-muted-foreground">
            Curated collections to help you find your next read
          </p>
        </div>
      </div>

      {/* Lists Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {CURATED_LISTS.map((list) => (
          <Link
            key={list.slug}
            href={`/lists/${list.slug}`}
            className="group block"
          >
            <article className="h-full rounded-xl border bg-card overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all">
              {/* Gradient Header */}
              <div
                className={`h-24 bg-gradient-to-br ${list.color || "from-primary to-primary/80"} flex items-center justify-center`}
              >
                <span className="text-4xl">{list.icon || "📚"}</span>
              </div>

              {/* Content */}
              <div className="p-5">
                <h2 className="text-lg font-semibold font-serif mb-2 group-hover:text-primary transition-colors">
                  {list.title}
                </h2>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {list.description}
                </p>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </div>
  );
}
