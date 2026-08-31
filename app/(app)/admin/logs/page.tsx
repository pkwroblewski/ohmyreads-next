import type { Metadata } from "next";
import {
  FileText,
  ChevronDown,
  User,
  Calendar,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AdminSelectFilter } from "@/components/admin/admin-filters";
import { AdminPagination } from "@/components/admin/admin-pagination";
import {
  adminGetAuditLogs,
  adminGetLogActionTypes,
} from "@/lib/queries/admin-logs";
import { type AuditAction } from "@/lib/utils/audit-log";
import {
  toAdminParams,
  readPage,
  type RawSearchParams,
} from "@/lib/admin/search-params";

export const metadata: Metadata = {
  title: "Audit Logs | Admin",
  robots: { index: false, follow: false },
};

const PATHNAME = "/admin/logs";
const LIMIT = 50;

// Action type to human-readable label
const actionLabels: Record<string, string> = {
  "moderation.book.approve": "Book Approved",
  "moderation.book.reject": "Book Rejected",
  "moderation.place.approve": "Place Approved",
  "moderation.place.reject": "Place Rejected",
  "admin.user.ban": "User Banned",
  "admin.user.unban": "User Unbanned",
  "admin.user.make_admin": "Made Admin",
  "admin.user.remove_admin": "Removed Admin",
  "admin.user.disable": "User Disabled",
  "admin.user.enable": "User Enabled",
  "admin.user.toggle_admin": "Admin Toggled",
  "moderation.review.delete": "Review Deleted",
  "moderation.comment.delete": "Comment Deleted",
  "admin.book.create": "Book Created",
  "admin.book.update": "Book Updated",
  "admin.book.delete": "Book Deleted",
  "admin.review.delete": "Review Deleted",
  "admin.review.flag": "Review Flagged",
  "admin.import.books": "Books Imported",
};

// Action type to color variant
const actionVariants: Record<string, string> = {
  approve: "bg-green-500/10 text-green-600",
  create: "bg-green-500/10 text-green-600",
  reject: "bg-red-500/10 text-red-600",
  delete: "bg-red-500/10 text-red-600",
  ban: "bg-red-500/10 text-red-600",
  disable: "bg-red-500/10 text-red-600",
  unban: "bg-green-500/10 text-green-600",
  enable: "bg-green-500/10 text-green-600",
  update: "bg-blue-500/10 text-blue-600",
  toggle: "bg-yellow-500/10 text-yellow-600",
  flag: "bg-yellow-500/10 text-yellow-600",
  import: "bg-purple-500/10 text-purple-600",
};

function getActionVariant(action: string): string {
  for (const key of Object.keys(actionVariants)) {
    if (action.includes(key)) {
      return actionVariants[key];
    }
  }
  return "bg-muted text-muted-foreground";
}

interface PageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function AdminLogsPage({ searchParams }: PageProps) {
  const params = toAdminParams(await searchParams);
  const page = readPage(params);

  const typesResult = await adminGetLogActionTypes();
  const actionTypes: AuditAction[] = typesResult.success
    ? typesResult.actionTypes ?? []
    : [];

  // An unknown action would silently return an empty page, so fall back to all.
  const action =
    params.action && (actionTypes as string[]).includes(params.action)
      ? params.action
      : "all";

  const result = await adminGetAuditLogs({
    action: action !== "all" ? (action as AuditAction) : undefined,
    page,
    limit: LIMIT,
  });

  const logs = result.success ? result.logs ?? [] : [];
  const total = result.success ? result.total ?? 0 : 0;
  const totalPages = result.success ? result.totalPages ?? 0 : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-serif">Audit Logs</h1>
            <p className="text-muted-foreground">
              {total.toLocaleString()} logged actions
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-card border">
        <AdminSelectFilter
          pathname={PATHNAME}
          params={params}
          name="action"
          value={action}
          defaultValue="all"
          placeholder="Filter by action"
          className="w-[250px]"
          options={[
            { value: "all", label: "All Actions" },
            ...actionTypes.map((a) => ({
              value: a,
              label: actionLabels[a] || a,
            })),
          ]}
        />
      </div>

      {/* Logs List */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {!result.success ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Could not load logs</p>
            <p className="text-sm">{result.error || "Please try again."}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No logs found</p>
            <p className="text-sm">No audit logs match your filters</p>
          </div>
        ) : (
          <div className="divide-y">
            {logs.map((log) => (
              // <details> rather than a useState row-expansion set: this page
              // has no mutations, so with native disclosure it needs no client
              // component at all.
              <details key={log.id} className="group">
                <summary className="p-4 hover:bg-muted/30 transition-colors cursor-pointer flex items-center gap-4 list-none">
                  {/* Action Badge */}
                  <Badge
                    className={`${getActionVariant(log.action)} min-w-[140px] justify-center`}
                  >
                    {actionLabels[log.action] || log.action}
                  </Badge>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-4 text-sm">
                      {log.user && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>
                            {log.user.display_name || log.user.username}
                          </span>
                        </div>
                      )}
                      {log.target_type && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Target className="h-4 w-4" />
                          <span>{log.target_type}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date(log.created_at).toLocaleString()}
                  </div>

                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>

                {/* Expanded Details */}
                <div className="px-4 pb-4">
                  <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Action</p>
                        <p className="font-mono">{log.action}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Target Type</p>
                        <p>{log.target_type || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Target ID</p>
                        <p className="font-mono text-xs">
                          {log.target_id || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">User ID</p>
                        <p className="font-mono text-xs">{log.user_id || "—"}</p>
                      </div>
                    </div>

                    {/* Metadata */}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div>
                        <p className="text-muted-foreground text-sm mb-2">
                          Metadata
                        </p>
                        <pre className="p-3 rounded bg-background text-xs overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Technical Info */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {log.ip_address && <span>IP: {log.ip_address}</span>}
                      {log.user_agent && (
                        <span className="truncate max-w-[300px]">
                          UA: {log.user_agent}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}

        <AdminPagination
          pathname={PATHNAME}
          params={params}
          page={page}
          totalPages={totalPages}
          total={total}
          label="logs"
        />
      </div>
    </div>
  );
}
