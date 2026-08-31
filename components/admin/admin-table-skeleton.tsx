import { Skeleton } from "@/components/ui/skeleton";

const STAT_GRID: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
};

interface AdminListSkeletonProps {
  /** Number of stat cards above the table, or 0 for none. */
  statCards?: number;
  /** Number of filter controls beside the search box. */
  filters?: number;
  /** Number of placeholder rows. */
  rows?: number;
}

/**
 * Shared shell for the admin list pages' `loading.tsx`. These pages fetch on
 * the server now, so the route suspends while the query runs — without a
 * boundary the admin would sit on the previous page with no feedback.
 */
export function AdminListSkeleton({
  statCards = 3,
  filters = 3,
  rows = 8,
}: AdminListSkeletonProps) {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-13 w-13 rounded-xl" />
        <div>
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      {statCards > 0 && (
        // Written out rather than interpolated: Tailwind scans source text, so
        // a `grid-cols-${n}` template would generate no class at all.
        <div className={`grid gap-4 ${STAT_GRID[statCards] ?? "grid-cols-3"}`}>
          {Array.from({ length: statCards }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl bg-card border">
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-card border">
        <div className="flex-1 min-w-[200px]">
          <Skeleton className="h-10 w-full" />
        </div>
        {Array.from({ length: filters }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-[150px]" />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b bg-muted/50 p-4">
          <Skeleton className="h-5 w-full max-w-md" />
        </div>
        <div className="divide-y">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
