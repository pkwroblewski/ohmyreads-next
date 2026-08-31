"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReadingStats } from "@/lib/queries/stats";

// Lazy load the heavy recharts bundle (~150KB)
const StatsCharts = dynamic(() => import("./stats-charts"), {
  ssr: false,
  loading: () => <StatsChartsSkeleton />,
});

function StatsChartsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-52" />

      <div className="grid lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-44 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface StatsChartsLazyProps {
  stats: ReadingStats;
}

export default function StatsChartsLazy({ stats }: StatsChartsLazyProps) {
  return <StatsCharts stats={stats} />;
}
