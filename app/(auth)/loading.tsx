import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder for the auth card, sized to the sign-in form so the page does not
 * jump when it arrives.
 */
export default function AuthLoading() {
  return (
    <div className="w-full max-w-md px-4">
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-5 w-64 mx-auto" />
        </div>

        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <Skeleton className="h-10 w-full" />
        </div>

        <Skeleton className="h-4 w-56 mx-auto" />
      </div>
    </div>
  );
}
