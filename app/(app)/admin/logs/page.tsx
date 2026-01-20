"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  Target,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  adminGetAuditLogs,
  adminGetLogActionTypes,
  type LogFilters,
  type AuditLogEntry,
} from "@/lib/queries/admin-logs";
import { type AuditAction } from "@/lib/utils/audit-log";

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

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionTypes, setActionTypes] = useState<AuditAction[]>([]);

  // Filters
  const [action, setAction] = useState<string>("all");
  const [page, setPage] = useState(1);
  const limit = 50;

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const result = await adminGetAuditLogs({
      action: action !== "all" ? (action as AuditAction) : undefined,
      page,
      limit,
    });

    if (result.success) {
      setLogs(result.logs || []);
      setTotal(result.total || 0);
      setTotalPages(result.totalPages || 0);
    }
    setLoading(false);
  }, [action, page]);

  const fetchActionTypes = useCallback(async () => {
    const result = await adminGetLogActionTypes();
    if (result.success && result.actionTypes) {
      setActionTypes(result.actionTypes);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void fetchActionTypes());
  }, [fetchActionTypes]);

  useEffect(() => {
    queueMicrotask(() => void fetchLogs());
  }, [fetchLogs]);

  const toggleRowExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

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
        <Select
          value={action}
          onValueChange={(v) => {
            setAction(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actionTypes.map((a) => (
              <SelectItem key={a} value={a}>
                {actionLabels[a] || a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Logs List */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
              <div key={log.id}>
                <div
                  className="p-4 hover:bg-muted/30 transition-colors cursor-pointer flex items-center gap-4"
                  onClick={() => toggleRowExpand(log.id)}
                >
                  {/* Action Badge */}
                  <Badge className={`${getActionVariant(log.action)} min-w-[140px] justify-center`}>
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

                  {/* Expand Icon */}
                  {expandedRows.has(log.id) ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>

                {/* Expanded Details */}
                {expandedRows.has(log.id) && (
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
                          <p className="font-mono text-xs">
                            {log.user_id || "—"}
                          </p>
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
                        {log.ip_address && (
                          <span>IP: {log.ip_address}</span>
                        )}
                        {log.user_agent && (
                          <span className="truncate max-w-[300px]">
                            UA: {log.user_agent}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({total} logs)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
