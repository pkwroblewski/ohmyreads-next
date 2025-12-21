"use client";

import { useState, useCallback } from "react";
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle, BookOpen } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { importFromGoodreads, type ImportResult } from "@/lib/actions/import";

type ImportState = "idle" | "reading" | "importing" | "done";

export function GoodreadsImport() {
  const [state, setState] = useState<ImportState>("idle");
  const [fileName, setFileName] = useState<string>("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string>("");

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.name.endsWith(".csv")) {
        setError("Please select a CSV file");
        return;
      }

      setError("");
      setFileName(file.name);
      setState("reading");

      try {
        // Read file content
        const content = await file.text();

        setState("importing");

        // Import books
        const importResult = await importFromGoodreads(content);
        setResult(importResult);
        setState("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to read file");
        setState("idle");
      }
    },
    []
  );

  const handleReset = useCallback(() => {
    setState("idle");
    setFileName("");
    setResult(null);
    setError("");
  }, []);

  // Idle state - show upload UI
  if (state === "idle") {
    return (
      <div className="space-y-6">
        {/* Instructions */}
        <div className="space-y-4 text-sm text-muted-foreground">
          <h3 className="font-medium text-foreground">How to export from Goodreads:</h3>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Go to{" "}
              <a
                href="https://www.goodreads.com/review/import"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                goodreads.com/review/import
              </a>
            </li>
            <li>Click &quot;Export Library&quot; at the top of the page</li>
            <li>Wait for the export to complete (this may take a few minutes)</li>
            <li>Download the CSV file when ready</li>
            <li>Upload the file here</li>
          </ol>
        </div>

        {/* Upload Area */}
        <label className="block cursor-pointer">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 hover:bg-accent/5 transition-colors">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium">
              Click to upload your Goodreads export
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              CSV file only
            </p>
          </div>
        </label>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>
    );
  }

  // Reading/Importing state - show progress
  if (state === "reading" || state === "importing") {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <FileText className="h-8 w-8 text-primary animate-pulse" />
        </div>
        <p className="text-sm font-medium">
          {state === "reading" ? "Reading file..." : "Importing books..."}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{fileName}</p>
      </div>
    );
  }

  // Done state - show results
  if (state === "done" && result) {
    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{result.matched}</p>
              <p className="text-xs text-muted-foreground">Books imported</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <XCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
              <p className="text-2xl font-bold">{result.notFound}</p>
              <p className="text-xs text-muted-foreground">Not in catalog</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <BookOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold">{result.skipped}</p>
              <p className="text-xs text-muted-foreground">Already on shelf</p>
            </CardContent>
          </Card>
        </div>

        {/* Errors */}
        {result.errors.length > 0 && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm font-medium text-destructive mb-2">Errors:</p>
            <ul className="text-xs text-destructive space-y-1">
              {result.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Not Found Books */}
        {result.notFoundBooks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">
                Books not in our catalog ({result.notFoundBooks.length})
              </h3>
              <a
                href="/submit-book"
                className="text-xs text-primary hover:underline"
              >
                Submit a book
              </a>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
              {result.notFoundBooks.slice(0, 50).map((book, i) => (
                <div key={i} className="px-3 py-2 text-sm">
                  <p className="font-medium truncate">{book.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    by {book.author}
                  </p>
                </div>
              ))}
              {result.notFoundBooks.length > 50 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  ...and {result.notFoundBooks.length - 50} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Successfully Imported */}
        {result.matchedBooks.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">
              Successfully imported ({result.matchedBooks.length})
            </h3>
            <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
              {result.matchedBooks.slice(0, 50).map((book, i) => (
                <div key={i} className="px-3 py-2 text-sm flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{book.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      by {book.author}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground ml-2 shrink-0">
                    {book.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
              {result.matchedBooks.length > 50 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  ...and {result.matchedBooks.length - 50} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleReset} variant="outline">
            Import another file
          </Button>
          <a href="/my-shelf" className={buttonVariants()}>
            View my shelf
          </a>
        </div>
      </div>
    );
  }

  return null;
}
