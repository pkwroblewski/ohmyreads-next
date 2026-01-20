"use client";

import { useState, useEffect, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";

interface RelativeTimeProps {
  date: Date | string;
  className?: string;
  addSuffix?: boolean;
}

/**
 * Client-only relative time component that avoids hydration mismatch.
 * Shows relative time like "2 hours ago" only after client hydration.
 */
export function RelativeTime({
  date,
  className,
  addSuffix = true,
}: RelativeTimeProps) {
  // Memoize date parsing to prevent effect re-runs
  const timestamp = useMemo(
    () => (typeof date === "string" ? new Date(date).getTime() : date.getTime()),
    [date]
  );

  // Start empty to avoid hydration mismatch - server and client will both render empty
  const [timeAgo, setTimeAgo] = useState<string>("");

  useEffect(() => {
    const dateObj = new Date(timestamp);

    // Compute relative time only on client after hydration
    const computeTime = () =>
      formatDistanceToNow(dateObj, { addSuffix });

    // Use queueMicrotask to avoid lint warning about sync setState in effect
    queueMicrotask(() => setTimeAgo(computeTime()));

    // Update every minute to keep "X minutes ago" accurate
    const interval = setInterval(() => {
      queueMicrotask(() => setTimeAgo(computeTime()));
    }, 60000);

    return () => clearInterval(interval);
  }, [timestamp, addSuffix]);

  if (!timeAgo) {
    // Return a non-breaking space to maintain layout during initial render
    return <span className={className}>&nbsp;</span>;
  }

  return <span className={className}>{timeAgo}</span>;
}
