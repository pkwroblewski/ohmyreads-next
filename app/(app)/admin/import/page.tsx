"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  Upload,
  FileText,
  Download,
  Check,
  X,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  parseCSVForPreview,
  importBooksFromCSV,
  type ImportResult,
} from "@/lib/actions/admin-import";
import { generateCSVTemplate, type ParsedBookRow } from "@/lib/utils/book-csv-parser";

type Step = "upload" | "preview" | "importing" | "results";

export default function AdminImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [csvContent, setCsvContent] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedBookRow[]>([]);
  const [parseStats, setParseStats] = useState({ total: 0, valid: 0, errors: 0 });
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setCsvContent(text);
    await handleParse(text);
  };

  const handleParse = async (content: string) => {
    setLoading(true);
    const result = await parseCSVForPreview(content);
    setLoading(false);

    if (result.success) {
      setParsedRows(result.rows);
      setParseStats({
        total: result.totalRows,
        valid: result.validRows,
        errors: result.errorRows,
      });
      setParseErrors(result.errors);
      setStep("preview");
    } else {
      setParseErrors(result.errors);
    }
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) return;

    setStep("importing");
    setLoading(true);

    const result = await importBooksFromCSV(validRows);

    setLoading(false);
    setImportResult(result);
    setStep("results");
  };

  const handleDownloadTemplate = () => {
    const template = generateCSVTemplate();
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "books_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setStep("upload");
    setCsvContent("");
    setParsedRows([]);
    setParseStats({ total: 0, valid: 0, errors: 0 });
    setParseErrors([]);
    setImportResult(null);
    setExpandedRows(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const toggleRowExpand = (rowNumber: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowNumber)) {
      newExpanded.delete(rowNumber);
    } else {
      newExpanded.add(rowNumber);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-serif">Bulk Import</h1>
            <p className="text-muted-foreground">
              Import books from CSV files
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleDownloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-card border">
        {[
          { key: "upload", label: "Upload", icon: Upload },
          { key: "preview", label: "Preview", icon: FileText },
          { key: "importing", label: "Import", icon: Loader2 },
          { key: "results", label: "Results", icon: Check },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === s.key
                  ? "bg-primary text-primary-foreground"
                  : ["upload", "preview", "importing", "results"].indexOf(step) >
                    ["upload", "preview", "importing", "results"].indexOf(s.key)
                  ? "bg-green-500 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {["upload", "preview", "importing", "results"].indexOf(step) >
              ["upload", "preview", "importing", "results"].indexOf(s.key) ? (
                <Check className="h-4 w-4" />
              ) : (
                <s.icon className={`h-4 w-4 ${s.key === "importing" && loading ? "animate-spin" : ""}`} />
              )}
            </div>
            <span className={step === s.key ? "font-medium" : "text-muted-foreground"}>
              {s.label}
            </span>
            {i < 3 && <div className="w-12 h-0.5 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {step === "upload" && (
        <div className="p-8 rounded-xl bg-card border">
          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              Drop your CSV file here or click to browse
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Supports CSV files with columns: title, author, isbn, description, genres, page_count, published_date, cover_url
            </p>
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Select File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {parseErrors.length > 0 && (
            <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="font-medium text-destructive mb-2">Parse Errors:</p>
              <ul className="list-disc list-inside text-sm text-destructive">
                {parseErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-card border">
              <p className="text-2xl font-bold">{parseStats.total}</p>
              <p className="text-sm text-muted-foreground">Total Rows</p>
            </div>
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <p className="text-2xl font-bold text-green-600">{parseStats.valid}</p>
              <p className="text-sm text-muted-foreground">Valid Rows</p>
            </div>
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-2xl font-bold text-red-600">{parseStats.errors}</p>
              <p className="text-sm text-muted-foreground">Rows with Errors</p>
            </div>
          </div>

          {/* Preview Table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-medium">Row</th>
                    <th className="text-left p-3 font-medium">Title</th>
                    <th className="text-left p-3 font-medium">Author</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parsedRows.map((row) => (
                    <>
                      <tr
                        key={row.rowNumber}
                        className="hover:bg-muted/30 cursor-pointer"
                        onClick={() => toggleRowExpand(row.rowNumber)}
                      >
                        <td className="p-3 text-muted-foreground">{row.rowNumber}</td>
                        <td className="p-3 font-medium">{row.title || "—"}</td>
                        <td className="p-3">{row.author || "—"}</td>
                        <td className="p-3">
                          {row.errors.length === 0 ? (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Valid
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <X className="h-3 w-3 mr-1" />
                              {row.errors.length} error(s)
                            </Badge>
                          )}
                        </td>
                        <td className="p-3">
                          {expandedRows.has(row.rowNumber) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </td>
                      </tr>
                      {expandedRows.has(row.rowNumber) && (
                        <tr>
                          <td colSpan={5} className="p-4 bg-muted/30">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">ISBN</p>
                                <p>{row.isbn || row.isbn13 || "—"}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Pages</p>
                                <p>{row.page_count || "—"}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Published</p>
                                <p>{row.published_date || "—"}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Genres</p>
                                <p>{row.genres.length > 0 ? row.genres.join(", ") : "—"}</p>
                              </div>
                              {row.description && (
                                <div className="col-span-2">
                                  <p className="text-muted-foreground">Description</p>
                                  <p className="line-clamp-2">{row.description}</p>
                                </div>
                              )}
                              {row.errors.length > 0 && (
                                <div className="col-span-2">
                                  <p className="text-destructive font-medium">Errors:</p>
                                  <ul className="list-disc list-inside text-destructive">
                                    {row.errors.map((err, i) => (
                                      <li key={i}>{err}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handleReset}>
              Start Over
            </Button>
            <Button
              onClick={handleImport}
              disabled={parseStats.valid === 0 || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {parseStats.valid} Book{parseStats.valid !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <div className="p-12 rounded-xl bg-card border text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-lg font-medium">Importing books...</p>
          <p className="text-muted-foreground">This may take a moment</p>
        </div>
      )}

      {step === "results" && importResult && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-card border">
              <p className="text-2xl font-bold">{importResult.totalRows}</p>
              <p className="text-sm text-muted-foreground">Total Processed</p>
            </div>
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
              <p className="text-sm text-muted-foreground">Imported</p>
            </div>
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-2xl font-bold text-yellow-600">{importResult.skipped}</p>
              <p className="text-sm text-muted-foreground">Skipped (Duplicates)</p>
            </div>
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-2xl font-bold text-red-600">{importResult.failed}</p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
          </div>

          {/* Results Table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-medium">Row</th>
                    <th className="text-left p-3 font-medium">Title</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {importResult.results.map((result) => (
                    <tr key={result.rowNumber} className="hover:bg-muted/30">
                      <td className="p-3 text-muted-foreground">{result.rowNumber}</td>
                      <td className="p-3 font-medium">{result.title}</td>
                      <td className="p-3">
                        {result.success && !result.skipped && (
                          <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                            <Check className="h-3 w-3 mr-1" />
                            Imported
                          </Badge>
                        )}
                        {result.skipped && (
                          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Skipped
                          </Badge>
                        )}
                        {!result.success && !result.skipped && (
                          <Badge variant="destructive">
                            <X className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {result.skipReason || result.error || "Successfully imported"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handleReset}>
              Import More Books
            </Button>
            <Link href="/admin/books">
              <Button>View All Books</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
