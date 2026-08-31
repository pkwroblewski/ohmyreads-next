import type { Metadata } from "next";
import Link from "next/link";
import { Flag, ExternalLink, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { requireAdmin } from "@/lib/auth/require-admin";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ReportRowActions } from "@/components/admin/report-row-actions";
import {
  toAdminParams,
  readEnum,
  buildAdminQuery,
  type RawSearchParams,
} from "@/lib/admin/search-params";
import {
  REPORT_REASON_LABELS,
  REPORT_TARGET_LABELS,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/validation/report";

export const metadata: Metadata = {
  title: "Reports | Admin",
  robots: { index: false, follow: false },
};

const PATHNAME = "/admin/reports";
const TABS = ["open", "resolved", "dismissed", "all"] as const;

/** Bounded like every other admin list (task 14): never select an open set. */
const PAGE_LIMIT = 200;

interface PageProps {
  searchParams: Promise<RawSearchParams>;
}

interface ReporterProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

/** What we can show about the reported thing, whatever kind it is. */
interface TargetSummary {
  excerpt: string;
  href?: string;
  hrefLabel?: string;
}

export default async function AdminReportsPage({ searchParams }: PageProps) {
  const { supabase } = await requireAdmin();

  const params = toAdminParams(await searchParams);
  const tab = readEnum(params, "status", TABS, "open");

  let query = supabase
    .from("reports")
    .select(
      `
      id,
      target_type,
      target_id,
      reason,
      details,
      status,
      resolution_note,
      resolved_at,
      created_at,
      reporter:profiles!reports_reporter_id_fkey(id, username, display_name, avatar_url),
      resolver:profiles!reports_resolved_by_fkey(id, username, display_name)
    `
    )
    // Bare descending order, matching `reports_status_created_at_idx`
    // (DESC NULLS FIRST) — see task 19.
    .order("created_at", { ascending: false })
    .limit(PAGE_LIMIT);

  if (tab !== "all") {
    query = query.eq("status", tab);
  }

  // Counts come from three head-only queries rather than from the list, so a
  // tab badge cannot read 0 just because another tab is open (the bug task 23
  // found on the submissions page).
  const [{ data, error }, openCount, resolvedCount, dismissedCount] =
    await Promise.all([
      query,
      supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "resolved"),
      supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "dismissed"),
    ]);

  const reports = data ?? [];

  // Resolve every target with one query per content type, not one per report.
  const idsByType = new Map<ReportTargetType, string[]>();
  for (const report of reports) {
    const type = report.target_type as ReportTargetType;
    idsByType.set(type, [...(idsByType.get(type) ?? []), report.target_id]);
  }

  const targets = new Map<string, TargetSummary>();
  const key = (type: string, id: string) => `${type}:${id}`;

  const [reviewRows, commentRows, photoRows] = await Promise.all([
    idsByType.get("review")?.length
      ? supabase
          .from("reviews")
          .select("id, summary, content, book:books(title, slug)")
          .in("id", idsByType.get("review")!)
      : Promise.resolve({ data: [] as never[] }),
    idsByType.get("comment")?.length
      ? supabase
          .from("comments")
          .select("id, content, review:reviews(id, book:books(title, slug))")
          .in("id", idsByType.get("comment")!)
      : Promise.resolve({ data: [] as never[] }),
    idsByType.get("place_photo")?.length
      ? supabase
          .from("place_photos")
          .select("id, caption, place:places(name, city)")
          .in("id", idsByType.get("place_photo")!)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  for (const row of reviewRows.data ?? []) {
    const book = Array.isArray(row.book) ? row.book[0] : row.book;
    targets.set(key("review", row.id), {
      excerpt: row.summary || row.content || "(empty review)",
      href: book?.slug ? `/books/${book.slug}` : undefined,
      hrefLabel: book?.title ? `Open “${book.title}”` : undefined,
    });
  }

  for (const row of commentRows.data ?? []) {
    const review = Array.isArray(row.review) ? row.review[0] : row.review;
    const book = review
      ? Array.isArray(review.book)
        ? review.book[0]
        : review.book
      : null;
    targets.set(key("comment", row.id), {
      excerpt: row.content || "(empty comment)",
      href: book?.slug ? `/books/${book.slug}` : undefined,
      hrefLabel: book?.title ? `Open “${book.title}”` : undefined,
    });
  }

  for (const row of photoRows.data ?? []) {
    const place = Array.isArray(row.place) ? row.place[0] : row.place;
    // `places` has no slug and the map has no per-place deep link, so the most
    // honest thing is to name the place and send the admin to the map.
    targets.set(key("place_photo", row.id), {
      excerpt: place?.name
        ? `Photo at ${place.name}${place.city ? `, ${place.city}` : ""} — ${row.caption || "no caption"}`
        : row.caption || "(photo with no caption)",
      href: "/community/map",
      hrefLabel: "Open the map",
    });
  }

  const counts = {
    open: openCount.count ?? 0,
    resolved: resolvedCount.count ?? 0,
    dismissed: dismissedCount.count ?? 0,
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Flag className="h-7 w-7 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-serif">Reports</h1>
          <p className="text-muted-foreground">
            Content readers have flagged for moderation
          </p>
        </div>
      </div>

      {/* Filter tabs — real links, so each tab is a shareable URL */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {TABS.map((value) => (
          <Link
            key={value}
            href={`${PATHNAME}${buildAdminQuery(params, {
              status: value === "open" ? undefined : value,
            })}`}
            scroll={false}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
              tab === value
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            {value.charAt(0).toUpperCase() + value.slice(1)}
            {value !== "all" && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-background/20 text-xs">
                {counts[value]}
              </span>
            )}
          </Link>
        ))}
      </div>

      {error ? (
        <div className="text-center py-16 bg-card rounded-xl border">
          <Flag className="h-12 w-12 mx-auto text-muted-foreground mb-4" aria-hidden="true" />
          <h2 className="text-lg font-semibold mb-2">Could not load reports</h2>
          <p className="text-muted-foreground">Please try again.</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border">
          <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" aria-hidden="true" />
          <h2 className="text-lg font-semibold mb-2">Nothing to review</h2>
          <p className="text-muted-foreground">
            {tab === "open"
              ? "No open reports. Everything readers flagged has been dealt with."
              : `No ${tab} reports.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const reporter = (Array.isArray(report.reporter)
              ? report.reporter[0]
              : report.reporter) as ReporterProfile | null;
            const resolver = Array.isArray(report.resolver)
              ? report.resolver[0]
              : report.resolver;
            const target = targets.get(
              key(report.target_type, report.target_id)
            );
            const reporterName =
              reporter?.display_name || reporter?.username || "Unknown";

            return (
              <div key={report.id} className="p-5 rounded-xl border bg-card">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-medium">
                      {REPORT_TARGET_LABELS[report.target_type as ReportTargetType]}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                      {REPORT_REASON_LABELS[report.reason as ReportReason]}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                      report.status === "open" && "bg-amber-500/10 text-amber-600",
                      report.status === "resolved" && "bg-green-500/10 text-green-600",
                      report.status === "dismissed" && "bg-muted text-muted-foreground"
                    )}
                  >
                    {report.status}
                  </span>
                </div>

                {/* The reported content itself */}
                <div className="p-3 rounded-lg bg-muted/50 mb-3">
                  {target ? (
                    <p className="text-sm line-clamp-3 whitespace-pre-wrap">
                      {target.excerpt}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      This content no longer exists — it was deleted after the
                      report was filed.
                    </p>
                  )}
                  {target?.href && (
                    <Link
                      href={target.href}
                      className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                    >
                      {target.hrefLabel ?? "Open"}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  )}
                </div>

                {report.details && (
                  <p className="text-sm text-muted-foreground mb-3">
                    <span className="font-medium text-foreground">
                      Reporter said:
                    </span>{" "}
                    {report.details}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-4">
                  <span>Reported by</span>
                  {reporter?.username ? (
                    <Link
                      href={`/users/${reporter.username}`}
                      className="flex items-center gap-2 hover:text-primary"
                    >
                      <Avatar className="h-5 w-5">
                        {reporter.avatar_url && (
                          <AvatarImage src={reporter.avatar_url} alt="" />
                        )}
                        <AvatarFallback className="text-[10px]">
                          {reporterName[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{reporterName}</span>
                    </Link>
                  ) : (
                    <span>{reporterName}</span>
                  )}
                  <span>
                    {formatDistanceToNow(new Date(report.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>

                {report.status === "open" ? (
                  <ReportRowActions reportId={report.id} />
                ) : (
                  <div className="p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                    {report.status === "resolved" ? "Resolved" : "Dismissed"}
                    {resolver &&
                      ` by ${resolver.display_name || resolver.username}`}
                    {report.resolved_at &&
                      ` ${formatDistanceToNow(new Date(report.resolved_at), {
                        addSuffix: true,
                      })}`}
                    {report.resolution_note && (
                      <span className="block mt-1 text-foreground">
                        “{report.resolution_note}”
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
