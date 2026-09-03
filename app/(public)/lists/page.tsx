import { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Library, Plus, Search, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CURATED_LISTS } from "@/lib/data/curated-lists";
import { getUserLists } from "@/lib/queries/lists";
import { getUser } from "@/lib/supabase/server";
import { ListCard } from "@/components/lists/list-card";

export const metadata: Metadata = {
  title: "Reading Lists",
  description:
    "Discover curated and community reading lists. Browse collections by genre, theme, or mood.",
  openGraph: {
    title: "Reading Lists",
    description: "Find your next great read with curated book collections.",
  },
};

interface ListsPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

async function CommunityLists({ search, page }: { search?: string; page: number }) {
  const { lists, total } = await getUserLists({
    page,
    limit: 12,
    search,
  });

  const totalPages = Math.ceil(total / 12);

  if (lists.length === 0 && !search) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No community lists yet. Be the first to create one!</p>
      </div>
    );
  }

  if (lists.length === 0 && search) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No lists found matching &ldquo;{search}&rdquo;</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => (
          <ListCard key={list.id} list={list} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Link href={`/lists?page=${page - 1}${search ? `&q=${search}` : ""}`}>
              <Button variant="outline" size="sm">
                Previous
              </Button>
            </Link>
          )}
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/lists?page=${page + 1}${search ? `&q=${search}` : ""}`}>
              <Button variant="outline" size="sm">
                Next
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default async function ListsPage({ searchParams }: ListsPageProps) {
  const params = await searchParams;
  const search = params.q;
  const page = parseInt(params.page || "1", 10);

  const {
    data: { user },
  } = await getUser();

  return (
    <div className="container max-w-6xl py-8 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10">
            <Library className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-serif">Reading Lists</h1>
            <p className="text-muted-foreground">
              Discover curated and community-created collections
            </p>
          </div>
        </div>
        {user && (
          <Link href="/lists/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create List
            </Button>
          </Link>
        )}
      </div>

      {/* Curated Lists Section */}
      <section id="curated" className="scroll-mt-20">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">Curated Collections</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CURATED_LISTS.map((list) => (
            <Link
              key={list.slug}
              href={`/lists/${list.slug}`}
              className="group block"
            >
              <article className="h-full rounded-xl border bg-card overflow-hidden hover:border-primary/50 hover:shadow-md transition-all">
                <div
                  className={`h-16 bg-gradient-to-br ${list.color || "from-primary to-primary/80"} flex items-center justify-center`}
                >
                  <span className="text-2xl">{list.icon || "?"}</span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold group-hover:text-primary transition-colors">
                    {list.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                    {list.description}
                  </p>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>

      {/* Community Lists Section */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Community Lists</h2>
          </div>
        </div>

        {/* Search */}
        <form action="/lists" method="GET" className="flex gap-2 max-w-md mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              name="q"
              placeholder="Search community lists..."
              defaultValue={search}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <Suspense
          fallback={
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-36 rounded-lg bg-muted animate-pulse"
                />
              ))}
            </div>
          }
        >
          <CommunityLists search={search} page={page} />
        </Suspense>
      </section>
    </div>
  );
}
