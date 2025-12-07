import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function UserProfileLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Header */}
      <section className="mb-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Skeleton className="h-24 w-24 sm:h-32 sm:w-32 rounded-full" />
          <div className="flex-1 text-center sm:text-left space-y-3">
            <Skeleton className="h-8 w-48 mx-auto sm:mx-0" />
            <Skeleton className="h-4 w-32 mx-auto sm:mx-0" />
            <Skeleton className="h-16 w-full max-w-xl" />
            <div className="flex gap-4 justify-center sm:justify-start">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Row */}
      <section className="mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4 text-center">
              <Skeleton className="h-5 w-5 mx-auto mb-2 rounded" />
              <Skeleton className="h-8 w-12 mx-auto mb-1" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </Card>
          ))}
        </div>
      </section>

      {/* Bookshelves */}
      <section className="mb-8">
        <Skeleton className="h-7 w-32 mb-4" />
        <div className="flex gap-2 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-[2/3] rounded-lg mb-2" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-2 w-2/3" />
            </div>
          ))}
        </div>
      </section>

      {/* Recent Reviews */}
      <section>
        <Skeleton className="h-7 w-40 mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex gap-4">
                <Skeleton className="w-12 h-18 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

