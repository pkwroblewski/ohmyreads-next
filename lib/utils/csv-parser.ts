/**
 * Simple CSV parser for Goodreads export format
 */

export interface GoodreadsRow {
  bookId: string;
  title: string;
  author: string;
  isbn: string;
  isbn13: string;
  myRating: number;
  averageRating: number;
  numberOfPages: number;
  dateRead: string | null;
  dateAdded: string;
  bookshelves: string[];
  exclusiveShelf: string;
}

/**
 * Parse a CSV string into rows
 * Handles quoted fields with commas and newlines
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        field += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(field.trim());
      field = "";
    } else {
      field += char;
    }
  }

  // Don't forget the last field
  fields.push(field.trim());

  return fields;
}

/**
 * Parse Goodreads CSV export into structured data
 */
export function parseGoodreadsCSV(csvContent: string): GoodreadsRow[] {
  // Split by newlines, handling both \r\n and \n
  const lines = csvContent.split(/\r?\n/);

  if (lines.length < 2) {
    throw new Error("CSV file is empty or has no data rows");
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

  // Find column indices for fields we care about
  const getIndex = (name: string): number => {
    const variations = [
      name,
      name.replace(/ /g, ""),
      name.replace(/-/g, " "),
    ];
    for (const v of variations) {
      const idx = headers.indexOf(v.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const indices = {
    bookId: getIndex("book id"),
    title: getIndex("title"),
    author: getIndex("author"),
    isbn: getIndex("isbn"),
    isbn13: getIndex("isbn13"),
    myRating: getIndex("my rating"),
    averageRating: getIndex("average rating"),
    numberOfPages: getIndex("number of pages"),
    dateRead: getIndex("date read"),
    dateAdded: getIndex("date added"),
    bookshelves: getIndex("bookshelves"),
    exclusiveShelf: getIndex("exclusive shelf"),
  };

  // Parse data rows
  const rows: GoodreadsRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);

    // Skip if we don't have enough fields
    if (fields.length < 5) continue;

    const getValue = (index: number): string => {
      if (index === -1 || index >= fields.length) return "";
      return fields[index] || "";
    };

    const getNumber = (index: number): number => {
      const val = getValue(index);
      const num = parseInt(val, 10);
      return isNaN(num) ? 0 : num;
    };

    // Clean ISBN - remove = and quotes from Goodreads format like ="0123456789"
    const cleanISBN = (val: string): string => {
      return val.replace(/^[="]+|[="]+$/g, "").trim();
    };

    const row: GoodreadsRow = {
      bookId: getValue(indices.bookId),
      title: getValue(indices.title),
      author: getValue(indices.author),
      isbn: cleanISBN(getValue(indices.isbn)),
      isbn13: cleanISBN(getValue(indices.isbn13)),
      myRating: getNumber(indices.myRating),
      averageRating: parseFloat(getValue(indices.averageRating)) || 0,
      numberOfPages: getNumber(indices.numberOfPages),
      dateRead: getValue(indices.dateRead) || null,
      dateAdded: getValue(indices.dateAdded),
      bookshelves: getValue(indices.bookshelves)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      exclusiveShelf: getValue(indices.exclusiveShelf),
    };

    // Only add rows with at least a title
    if (row.title) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Map Goodreads shelf to our status
 */
export function mapGoodreadsShelf(
  exclusiveShelf: string
): "want_to_read" | "reading" | "read" {
  const shelf = exclusiveShelf.toLowerCase().trim();

  if (shelf === "currently-reading" || shelf === "currently reading") {
    return "reading";
  }

  if (shelf === "read") {
    return "read";
  }

  // Default to want_to_read for "to-read" and anything else
  return "want_to_read";
}
