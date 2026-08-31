"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as Sentry from "@sentry/nextjs";

/**
 * Group-level fallback for the public site.
 *
 * `books/` and `community/` keep their own, more specific boundaries; this one
 * catches everything else — authors, clubs, discover, lists, trending, the
 * marketing pages — which previously fell all the way through to the root
 * boundary and lost the navbar and footer with it.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="container max-w-4xl py-12">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-destructive/10">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold font-serif">
            Couldn&apos;t load this page
          </h1>
          <p className="text-muted-foreground">
            We had trouble putting this page together. This is usually
            temporary.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground font-mono">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Link href="/discover">
            <Button variant="outline">Browse Books</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
