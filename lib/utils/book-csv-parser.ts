/**
 * CSV Parser for Book Import
 *
 * Expected CSV format:
 * title,author,isbn,description,genres,page_count,published_date,cover_url
 *
 * Genres should be pipe-separated: "Fiction|Fantasy|Adventure"
 */

export interface ParsedBookRow {
  title: string;
  author: string;
  isbn?: string;
  isbn13?: string;
  description?: string;
  genres: string[];
  page_count?: number;
  published_date?: string;
  cover_url?: string;
  rowNumber: number;
  errors: string[];
}

export interface ParseResult {
  success: boolean;
  rows: ParsedBookRow[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: string[];
}

// Parse CSV string into rows
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      // Escaped quote
      current += '"';
      i++; // Skip next quote
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current.trim());

  return result;
}

// Validate and parse a single row
function parseRow(fields: string[], headers: string[], rowNumber: number): ParsedBookRow {
  const row: ParsedBookRow = {
    title: "",
    author: "",
    genres: [],
    rowNumber,
    errors: [],
  };

  // Create a map of header -> value
  const data: Record<string, string> = {};
  headers.forEach((header, index) => {
    data[header.toLowerCase().trim()] = fields[index] || "";
  });

  // Required: title
  row.title = data.title || data.name || "";
  if (!row.title) {
    row.errors.push("Missing required field: title");
  }

  // Required: author
  row.author = data.author || data.authors || "";
  if (!row.author) {
    row.errors.push("Missing required field: author");
  }

  // Optional: ISBN
  const isbn = data.isbn || data.isbn10 || "";
  if (isbn) {
    const cleanIsbn = isbn.replace(/[-\s]/g, "");
    if (cleanIsbn.length === 10) {
      row.isbn = cleanIsbn;
    } else if (cleanIsbn.length === 13) {
      row.isbn13 = cleanIsbn;
    } else if (cleanIsbn.length > 0) {
      row.errors.push(`Invalid ISBN format: ${isbn}`);
    }
  }

  // Optional: ISBN13
  const isbn13 = data.isbn13 || "";
  if (isbn13 && !row.isbn13) {
    const cleanIsbn13 = isbn13.replace(/[-\s]/g, "");
    if (cleanIsbn13.length === 13) {
      row.isbn13 = cleanIsbn13;
    } else if (cleanIsbn13.length > 0) {
      row.errors.push(`Invalid ISBN-13 format: ${isbn13}`);
    }
  }

  // Optional: description
  row.description = data.description || data.synopsis || data.summary || "";

  // Optional: genres (pipe or comma separated)
  const genresStr = data.genres || data.genre || data.categories || data.category || "";
  if (genresStr) {
    row.genres = genresStr
      .split(/[|,;]/)
      .map((g) => g.trim())
      .filter(Boolean);
  }

  // Optional: page count
  const pageCountStr = data.page_count || data.pages || data.pagecount || "";
  if (pageCountStr) {
    const pageCount = parseInt(pageCountStr, 10);
    if (!isNaN(pageCount) && pageCount > 0) {
      row.page_count = pageCount;
    } else if (pageCountStr.length > 0) {
      row.errors.push(`Invalid page count: ${pageCountStr}`);
    }
  }

  // Optional: published date
  const publishedStr = data.published_date || data.published || data.publication_date || data.date || "";
  if (publishedStr) {
    // Try to parse as date
    const date = new Date(publishedStr);
    if (!isNaN(date.getTime())) {
      row.published_date = date.toISOString().split("T")[0];
    } else {
      // Try year only
      const year = parseInt(publishedStr, 10);
      if (year >= 1000 && year <= 9999) {
        row.published_date = `${year}-01-01`;
      } else {
        row.errors.push(`Invalid date format: ${publishedStr}`);
      }
    }
  }

  // Optional: cover URL
  const coverUrl = data.cover_url || data.cover || data.image || data.image_url || "";
  if (coverUrl) {
    try {
      new URL(coverUrl);
      row.cover_url = coverUrl;
    } catch {
      row.errors.push(`Invalid cover URL: ${coverUrl}`);
    }
  }

  return row;
}

/**
 * Parse a CSV string into book rows
 */
export function parseBookCSV(csvContent: string): ParseResult {
  const errors: string[] = [];
  const rows: ParsedBookRow[] = [];

  // Split into lines, handling different line endings
  const lines = csvContent
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim());

  if (lines.length < 2) {
    return {
      success: false,
      rows: [],
      totalRows: 0,
      validRows: 0,
      errorRows: 0,
      errors: ["CSV file must have a header row and at least one data row"],
    };
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  // Check for required headers
  const headerLower = headers.map((h) => h.toLowerCase().trim());
  const hasTitle = headerLower.includes("title") || headerLower.includes("name");
  const hasAuthor = headerLower.includes("author") || headerLower.includes("authors");

  if (!hasTitle) {
    errors.push("Missing required header: title");
  }
  if (!hasAuthor) {
    errors.push("Missing required header: author");
  }

  if (errors.length > 0) {
    return {
      success: false,
      rows: [],
      totalRows: lines.length - 1,
      validRows: 0,
      errorRows: lines.length - 1,
      errors,
    };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    const row = parseRow(fields, headers, i + 1);
    rows.push(row);
  }

  const validRows = rows.filter((r) => r.errors.length === 0).length;
  const errorRows = rows.filter((r) => r.errors.length > 0).length;

  return {
    success: true,
    rows,
    totalRows: rows.length,
    validRows,
    errorRows,
    errors,
  };
}

/**
 * Generate a sample CSV template
 */
export function generateCSVTemplate(): string {
  return `title,author,isbn,isbn13,description,genres,page_count,published_date,cover_url
"The Great Gatsby","F. Scott Fitzgerald","0743273567","9780743273565","A story of decadence and excess","Fiction|Classic|Literary Fiction",180,1925-04-10,https://example.com/gatsby.jpg
"1984","George Orwell","0451524934","9780451524935","A dystopian social science fiction novel","Fiction|Dystopian|Science Fiction",328,1949-06-08,https://example.com/1984.jpg`;
}
