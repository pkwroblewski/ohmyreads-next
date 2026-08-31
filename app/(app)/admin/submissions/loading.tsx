import { Skeleton } from "@/components/ui/skeleton";

export default function AdminSubmissionsLoading() {
  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <Skeleton className="h-7 w-52 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex gap-2 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-28 rounded-lg" />
        ))}
      </div>

      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-6 rounded-xl border bg-card flex gap-6">
            <Skeleton className="w-24 h-36 rounded flex-shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-6 w-64 mb-2" />
              <Skeleton className="h-4 w-40 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-4" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
