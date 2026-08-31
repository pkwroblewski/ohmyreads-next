import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function StatsLoading() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-background">
        <div className="container max-w-6xl py-12 md:py-16">
          <Skeleton className="h-9 w-56 mb-3" />
          <Skeleton className="h-5 w-72 mb-10" />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
        </div>
      </div>

      {/* Reading Goal */}
      <div className="container max-w-6xl py-8">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </Card>
      </div>

      {/* Charts */}
      <div className="container max-w-6xl pb-8 space-y-6">
        <Skeleton className="h-8 w-52" />
        <div className="grid lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-6 w-44 mb-2" />
              <Skeleton className="h-4 w-32 mb-6" />
              <Skeleton className="h-[300px] w-full rounded-lg" />
            </Card>
          ))}
        </div>
      </div>

      {/* Highlights */}
      <div className="container max-w-6xl pb-12 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-5 w-32 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
