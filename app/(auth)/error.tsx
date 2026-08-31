"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as Sentry from "@sentry/nextjs";

/**
 * Boundary for sign-in, sign-up and password recovery.
 *
 * These routes had none, so any failure fell through to the root boundary,
 * which replaces the whole document — including the header that gets a stuck
 * visitor back out — with copy that says nothing about signing in. This one
 * renders inside the auth layout and points at the two places a person in the
 * middle of authenticating actually wants to go.
 */
export default function AuthError({
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
    <div className="w-full max-w-md px-4">
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
            Something went wrong on our side. Your account is fine — please try
            again.
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
          <Link href="/login">
            <Button variant="outline">Back to Sign In</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
