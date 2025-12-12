import { Skeleton } from "@/components/ui/skeleton";
import { ReviewListSkeleton, BookListSkeleton } from "@/components/skeletons";

export default function BookLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header: Cover + Info */}
      <div className="flex flex-col md:flex-row gap-8 mb-12">
        {/* Cover */}
        <div className="md:w-72 flex-shrink-0 mx-auto md:mx-0">
          <Skeleton className="w-72 aspect-[2/3] rounded-xl" />
        </div>

        {/* Info */}
        <div className="flex-1 space-y-4">
          <Skeleton className="h-10 w-3/4" /> {/* Title */}
          <Skeleton className="h-6 w-1/3" /> {/* Author */}
          <Skeleton className="h-5 w-1/4" /> {/* Rating */}
          
          {/* Genres */}
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>

          {/* Meta */}
          <Skeleton className="h-4 w-40" />

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="mb-12">
        <Skeleton className="h-7 w-40 mb-4" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>

      {/* Reviews */}
      <div className="mb-12">
        <Skeleton className="h-7 w-32 mb-6" />
        <ReviewListSkeleton count={2} />
      </div>

      {/* Related Books */}
      <div>
        <Skeleton className="h-7 w-48 mb-4" />
        <BookListSkeleton count={4} />
      </div>
    </div>
  );
}

