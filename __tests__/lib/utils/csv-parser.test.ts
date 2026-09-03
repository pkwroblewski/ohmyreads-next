/**
 * Goodreads CSV parser (Phase 2, Task 21, finding T7).
 *
 * The export format is hostile in small ways: titles with commas are quoted,
 * ISBNs arrive as the spreadsheet-preserving `="9780..."`, line endings are
 * CRLF, and the column order is whatever Goodreads shipped that year.
 */

import { describe, it, expect } from "vitest";
import { parseGoodreadsCSV, mapGoodreadsShelf } from "@/lib/utils/csv-parser";

const HEADER =
  "Book Id,Title,Author,ISBN,ISBN13,My Rating,Average Rating,Number of Pages,Date Read,Date Added,Bookshelves,Exclusive Shelf";

describe("parseGoodreadsCSV", () => {
  it("keeps commas inside quoted fields and unescapes doubled quotes", () => {
    const csv = [
      HEADER,
      `1,"Dune, Part One","Herbert, Frank",="0441013597",="9780441013593",5,4.25,412,2024/01/15,2023/12/01,"favorites, sci-fi",read`,
      `2,"The ""Real"" Book",Someone,,,0,3.5,100,,2024/02/02,,to-read`,
    ].join("\n");

    const rows = parseGoodreadsCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      bookId: "1",
      title: "Dune, Part One",
      author: "Herbert, Frank",
      myRating: 5,
      averageRating: 4.25,
      numberOfPages: 412,
      dateRead: "2024/01/15",
      dateAdded: "2023/12/01",
      bookshelves: ["favorites", "sci-fi"],
      exclusiveShelf: "read",
    });
    expect(rows[1].title).toBe('The "Real" Book');
    expect(rows[1].dateRead).toBeNull();
    expect(rows[1].bookshelves).toEqual([]);
  });

  it("strips the ISBN spreadsheet wrapper (equals sign and quotes)", () => {
    const rows = parseGoodreadsCSV(
      [HEADER, `1,Book,Author,="0441013597",="9780441013593",0,0,0,,2024/01/01,,to-read`].join("\n")
    );
    expect(rows[0].isbn).toBe("0441013597");
    expect(rows[0].isbn13).toBe("9780441013593");
  });

  it("handles CRLF line endings and blank trailing lines", () => {
    const rows = parseGoodreadsCSV(
      `${HEADER}\r\n1,Book A,Author,,,3,0,0,,2024/01/01,,read\r\n2,Book B,Author,,,0,0,0,,2024/01/02,,to-read\r\n\r\n`
    );
    expect(rows.map((r) => r.title)).toEqual(["Book A", "Book B"]);
    expect(rows[0].myRating).toBe(3);
  });

  it("reads columns by header name, whatever the order", () => {
    const rows = parseGoodreadsCSV(
      [
        "Exclusive Shelf,Author,Title,ISBN13,My Rating,Date Added",
        `currently-reading,Ann,Shuffled,="9780000000001",4,2024/03/03`,
      ].join("\n")
    );
    expect(rows[0]).toMatchObject({
      title: "Shuffled",
      author: "Ann",
      isbn13: "9780000000001",
      myRating: 4,
      exclusiveShelf: "currently-reading",
      isbn: "",
      bookId: "",
    });
  });

  it("skips short or title-less lines and non-numeric numbers become 0", () => {
    const rows = parseGoodreadsCSV(
      [HEADER, "1,2,3", `4,,Author,,,x,y,z,,2024/01/01,,read`, `5,Real,Author,,,abc,,,,2024/01/01,,read`].join("\n")
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: "Real", myRating: 0, averageRating: 0, numberOfPages: 0 });
  });

  it("throws on a header-only file", () => {
    expect(() => parseGoodreadsCSV(HEADER)).toThrow(/empty|no data/i);
  });
});

describe("mapGoodreadsShelf", () => {
  it("maps the three exclusive shelves and defaults the rest to want_to_read", () => {
    expect(mapGoodreadsShelf("read")).toBe("read");
    expect(mapGoodreadsShelf(" READ ")).toBe("read");
    expect(mapGoodreadsShelf("currently-reading")).toBe("reading");
    expect(mapGoodreadsShelf("Currently Reading")).toBe("reading");
    expect(mapGoodreadsShelf("to-read")).toBe("want_to_read");
    expect(mapGoodreadsShelf("abandoned")).toBe("want_to_read");
    expect(mapGoodreadsShelf("")).toBe("want_to_read");
  });
});
