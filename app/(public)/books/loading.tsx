import { Skeleton } from "@/components/ui/skeleton";
import { BookGridSkeleton } from "@/components/skeletons";

export default function BrowseBooksLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Search Bar */}
      <Skeleton className="h-12 w-full mb-6" />

      {/* Genre Pills */}
      <div className="flex gap-2 mb-6 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-full flex-shrink-0" />
        ))}
      </div>

      {/* Results Count */}
      <Skeleton className="h-4 w-32 mb-6" />

      {/* Book Grid */}
      <BookGridSkeleton count={20} />
    </div>
  );
}

