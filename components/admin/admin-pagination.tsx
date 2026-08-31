import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildAdminQuery, type AdminParams } from "@/lib/admin/search-params";

interface AdminPaginationProps {
  pathname: string;
  params: AdminParams;
  page: number;
  totalPages: number;
  total: number;
  /** Plural noun for the count line, e.g. "users". */
  label: string;
}

/**
 * Pagination as plain links — a server component, so paging ships no client
 * JavaScript and each page is a real, shareable URL.
 *
 * Wrapping `Button` in `Link` rather than using `asChild`: this project's
 * Button is a plain styled button with no Slot support.
 */
export function AdminPagination({
  pathname,
  params,
  page,
  totalPages,
  total,
  label,
}: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  // Dropping `page` entirely for page 1 keeps the canonical first-page URL free
  // of a redundant `?page=1`.
  const prevHref = `${pathname}${buildAdminQuery(params, {
    page: page - 1 === 1 ? undefined : page - 1,
  })}`;
  const nextHref = `${pathname}${buildAdminQuery(params, { page: page + 1 })}`;

  return (
    <div className="flex items-center justify-between p-4 border-t bg-muted/30">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages} ({total.toLocaleString()} {label})
      </p>
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link href={prevHref} scroll={false}>
            <Button variant="outline" size="sm">
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
        )}

        {hasNext ? (
          <Link href={nextHref} scroll={false}>
            <Button variant="outline" size="sm">
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
