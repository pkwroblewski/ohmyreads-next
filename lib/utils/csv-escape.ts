/**
 * Escape one value for a CSV cell.
 *
 * Beyond RFC 4180 quoting, a cell that starts with `=`, `+`, `-`, `@`, tab or
 * carriage return is prefixed with a single quote so spreadsheet apps treat it
 * as text rather than a formula. Without that, a book titled
 * `=HYPERLINK("https://evil.example","Click")` — or any user-written review —
 * would execute when the export is opened in Excel or LibreOffice.
 */
export function escapeCsv(value: string | null | undefined): string {
  if (!value) return "";
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
