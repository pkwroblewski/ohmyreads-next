import { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Users, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getClubs, getUserClubs } from "@/lib/queries/clubs";
import { getUser } from "@/lib/supabase/server";
import { ClubCard } from "@/components/clubs/club-card";

export const metadata: Metadata = {
  title: "Book Clubs",
  description: "Join book clubs and read together with other book lovers",
};

interface ClubsPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

async function MyClubsSection() {
  const userClubs = await getUserClubs();

  if (userClubs.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">My Clubs</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {userClubs.map((club) => (
          <ClubCard key={club.id} club={club} />
        ))}
      </div>
    </section>
  );
}

async function ClubsList({ search, page }: { search?: string; page: number }) {
  const { clubs, total } = await getClubs({
    page,
    limit: 12,
    search,
  });

  const totalPages = Math.ceil(total / 12);

  if (clubs.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No clubs found</h3>
        <p className="text-muted-foreground mb-4">
          {search
            ? "Try a different search term"
            : "Be the first to create a book club!"}
        </p>
        <Link href="/clubs/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create a Club
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clubs.map((club) => (
          <ClubCard key={club.id} club={club} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Link href={`/clubs?page=${page - 1}${search ? `&q=${search}` : ""}`}>
              <Button variant="outline" size="sm">
                Previous
              </Button>
            </Link>
          )}
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/clubs?page=${page + 1}${search ? `&q=${search}` : ""}`}>
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

export default async function ClubsPage({ searchParams }: ClubsPageProps) {
  const params = await searchParams;
  const search = params.q;
  const page = parseInt(params.page || "1", 10);

  const {
    data: { user },
  } = await getUser();

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Book Clubs</h1>
            <p className="text-muted-foreground">
              Read together with fellow book lovers
            </p>
          </div>
        </div>
        {user && (
          <Link href="/clubs/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Club
            </Button>
          </Link>
        )}
      </div>

      {/* My Clubs Section */}
      {user && (
        <Suspense fallback={null}>
          <MyClubsSection />
        </Suspense>
      )}

      {/* Search */}
      <form action="/clubs" method="GET" className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            name="q"
            placeholder="Search clubs..."
            defaultValue={search}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {/* Public Clubs */}
      <h2 className="text-lg font-semibold">Discover Clubs</h2>
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-lg bg-muted animate-pulse"
              />
            ))}
          </div>
        }
      >
        <ClubsList search={search} page={page} />
      </Suspense>
    </div>
  );
}
