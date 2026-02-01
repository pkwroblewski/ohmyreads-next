import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * Skeleton for the stats grid (4 stat cards)
 */
export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-6">
          <div className="flex items-start justify-between mb-4">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
          <Skeleton className="h-4 w-24" />
        </Card>
      ))}
    </div>
  );
}

/**
 * Skeleton for the currently reading section
 */
export function CurrentlyReadingSkeleton() {
  return (
    <section className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-36">
            <Skeleton className="aspect-[2/3] rounded-lg mb-2" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Skeleton for friends activity section
 */
export function FriendsActivitySkeleton() {
  return (
    <section className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 items-center p-3 rounded-lg bg-card border border-border"
          >
            <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
            <Skeleton className="w-8 h-12 rounded flex-shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-4 w-48 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Skeleton for recommendations section
 */
export function RecommendationsSkeleton() {
  return (
    <section className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-44" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-40">
            <Skeleton className="aspect-[2/3] rounded-lg mb-2" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-3 w-2/3 mb-1" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Skeleton for recent activity section
 */
export function RecentActivitySkeleton() {
  return (
    <section className="mb-8">
      <Skeleton className="h-6 w-36 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 items-center p-3 rounded-lg bg-card border border-border"
          >
            <Skeleton className="w-10 h-14 rounded flex-shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-4 w-48 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
