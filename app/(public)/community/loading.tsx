import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

function ActivityCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Header: avatar, name, action, timestamp */}
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>

        {/* Content: book cover + info */}
        <div className="mt-3 flex gap-3 p-3 rounded-lg bg-muted/50">
          <Skeleton className="h-24 w-16 rounded-md flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-4">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
      </CardContent>
    </Card>
  );
}

function SidebarSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CommunityLoading() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid lg:grid-cols-[280px_1fr_280px] gap-6">
          {/* Left Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <SidebarSkeleton />
            </div>
          </aside>

          {/* Center - Activity Feed */}
          <main className="space-y-4">
            {/* Tab buttons */}
            <div className="flex gap-2 mb-4">
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="h-9 w-24 rounded-md" />
            </div>

            {/* Activity cards */}
            {[1, 2, 3, 4].map((i) => (
              <ActivityCardSkeleton key={i} />
            ))}
          </main>

          {/* Right Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              <SidebarSkeleton />
              <SidebarSkeleton />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
