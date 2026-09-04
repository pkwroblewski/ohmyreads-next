"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileJson, FileSpreadsheet, Loader2 } from "lucide-react";

type ExportFormat = "json" | "csv";

export function ExportSection() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(format: ExportFormat) {
    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch(`/api/export?format=${format}`);

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to export data");
        return;
      }

      // Get the blob and trigger download
      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename =
        filenameMatch?.[1] ||
        `ohmyreads-export.${format === "json" ? "json" : "csv"}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Export your reading data including books, reviews, challenges, and more.
        You can export once per hour.
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => handleExport("json")}
          disabled={isExporting}
          className="gap-2"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileJson className="h-4 w-4" />
          )}
          Export as JSON
        </Button>

        <Button
          variant="outline"
          onClick={() => handleExport("csv")}
          disabled={isExporting}
          className="gap-2"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          Export as CSV
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="text-xs text-muted-foreground space-y-1">
        <p className="flex items-center gap-1.5">
          <Download className="h-3 w-3" />
          <span>
            <strong>JSON</strong> - Full data with nested structure, best for
            backups
          </span>
        </p>
        <p className="flex items-center gap-1.5">
          <Download className="h-3 w-3" />
          <span>
            <strong>CSV</strong> - Flat format, opens in Excel/Google Sheets
          </span>
        </p>
      </div>
    </div>
  );
}
