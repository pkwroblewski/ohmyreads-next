import { describe, expect, it, vi } from "vitest";
import {
  NytApiError,
  cleanAuthor,
  fetchOverview,
  firstSundays,
  isBoxSet,
  listGenres,
  parseOverview,
  stripEditionSuffix,
  titleCase,
} from "@/lib/import/nyt";

const OVERVIEW = {
  status: "OK",
  results: {
    published_date: "2026-01-04",
    lists: [
      {
        list_name_encoded: "hardcover-fiction",
        display_name: "Hardcover Fiction",
        books: [
          {
            rank: 1,
            title: "THE WIDOW",
            author: "John Grisham",
            primary_isbn13: "9780385548984",
            description: "A lawyer is accused of murder.",
            book_image: "https://static01.nyt.com/bestsellers/images/9780385548984.jpg",
            weeks_on_list: 9,
          },
          {
            rank: 2,
            title: "NO ISBN",
            author: "Anon",
            primary_isbn13: "",
            isbns: [{ isbn13: "9781111111111" }],
          },
          { rank: 3, title: "", author: "Nobody" },
        ],
      },
      { list_name_encoded: "picture-books", books: [] },
    ],
  },
};

describe("parseOverview", () => {
  it("flattens lists into entries and falls back to the isbns array", () => {
    const { publishedDate, entries } = parseOverview(OVERVIEW);
    expect(publishedDate).toBe("2026-01-04");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      listName: "hardcover-fiction",
      listDisplayName: "Hardcover Fiction",
      publishedDate: "2026-01-04",
      rank: 1,
      title: "THE WIDOW",
      author: "John Grisham",
      primaryIsbn13: "9780385548984",
      weeksOnList: 9,
    });
    expect(entries[1].primaryIsbn13).toBe("9781111111111");
    expect(entries[1].description).toBeNull();
    expect(entries[1].bookImage).toBeNull();
  });

  it("tolerates an empty or malformed body", () => {
    expect(parseOverview(null).entries).toEqual([]);
    expect(parseOverview({ results: {} }).entries).toEqual([]);
  });
});

describe("fetchOverview", () => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });

  it("sends the date and key, and parses the body", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(OVERVIEW));
    const result = await fetchOverview("2026-01-04", { apiKey: "k", fetchImpl });
    expect(result.entries).toHaveLength(2);
    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.searchParams.get("published_date")).toBe("2026-01-04");
    expect(url.searchParams.get("api-key")).toBe("k");
  });

  it("retries once after a 429", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json(OVERVIEW));
    const result = await fetchOverview("2026-01-04", {
      apiKey: "k",
      fetchImpl,
      retryDelayMs: 0,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.entries).toHaveLength(2);
  });

  it("throws NytApiError with the status on other failures", async () => {
    const fetchImpl = vi.fn(async () => json({}, 401));
    await expect(
      fetchOverview("2026-01-04", { apiKey: "k", fetchImpl })
    ).rejects.toMatchObject({ name: "NytApiError", status: 401 });
    await expect(
      fetchOverview("2026-01-04", { apiKey: "k", fetchImpl })
    ).rejects.toBeInstanceOf(NytApiError);
  });
});

describe("firstSundays", () => {
  it("returns the first Sunday of each month, inclusive", () => {
    expect(firstSundays("2016-01", "2016-03")).toEqual([
      "2016-01-03",
      "2016-02-07",
      "2016-03-06",
    ]);
  });

  it("crosses year boundaries and handles a month that starts on Sunday", () => {
    expect(firstSundays("2025-11", "2026-02")).toEqual([
      "2025-11-02",
      "2025-12-07",
      "2026-01-04",
      "2026-02-01",
    ]);
  });

  it("rejects malformed input", () => {
    expect(() => firstSundays("2016", "2016-03")).toThrow(/YYYY-MM/);
  });
});

describe("titleCase", () => {
  it("capitalises words and keeps small words lower-case", () => {
    expect(titleCase("THE GIRL ON THE TRAIN")).toBe("The Girl on the Train");
    expect(titleCase("ALL THE LIGHT WE CANNOT SEE")).toBe("All the Light We Cannot See");
  });

  it("keeps small words at the end and after a colon", () => {
    expect(titleCase("WHAT IT IS ABOUT")).toBe("What It Is About");
    expect(titleCase("TOM CLANCY: THE DIVISION")).toBe("Tom Clancy: The Division");
  });

  it("touches only the first letter of each word and hyphen part", () => {
    expect(titleCase("DON'T LET GO")).toBe("Don't Let Go");
    expect(titleCase("MOTHER-DAUGHTER MURDER NIGHT")).toBe("Mother-Daughter Murder Night");
    expect(titleCase("'SALEM'S LOT")).toBe("'Salem's Lot");
  });
});

describe("cleanAuthor", () => {
  it("drops illustrator credits and a leading 'by'", () => {
    expect(cleanAuthor("Adam Rubin. Illustrated by Daniel Salmieri")).toBe("Adam Rubin");
    expect(cleanAuthor("Mo Willems, illustrated by Mo Willems")).toBe("Mo Willems");
    expect(cleanAuthor("by Emily Henry")).toBe("Emily Henry");
  });

  it("keeps co-authors", () => {
    expect(cleanAuthor("Stephen King and Owen King")).toBe("Stephen King and Owen King");
  });
});

describe("isBoxSet", () => {
  it("matches multi-volume products only", () => {
    expect(isBoxSet("HARRY POTTER BOXED SET")).toBe(true);
    expect(isBoxSet("DIARY OF A WIMPY KID: 3 BOOKS")).toBe(true);
    expect(isBoxSet("THE COMPLETE COLLECTION")).toBe(true);
    expect(isBoxSet("JUJUTSU KAISEN, VOL. 30")).toBe(true);
    expect(isBoxSet("THE COLLECTOR")).toBe(false);
    expect(isBoxSet("THE 5 LOVE LANGUAGES")).toBe(false);
    expect(isBoxSet("VOLUME CONTROL")).toBe(false);
  });
});

describe("stripEditionSuffix", () => {
  it("drops edition notes so editions collapse onto one row", () => {
    expect(stripEditionSuffix("HARRY POTTER AND THE GOBLET OF FIRE (FULL-CAST EDITION)")).toBe(
      "HARRY POTTER AND THE GOBLET OF FIRE"
    );
    expect(stripEditionSuffix("THE HOBBIT (ILLUSTRATED EDITION)")).toBe("THE HOBBIT");
    expect(stripEditionSuffix("DUNE [MOVIE TIE-IN]")).toBe("DUNE");
  });

  it("keeps parentheses that are part of the title", () => {
    expect(stripEditionSuffix("EVERYTHING I KNOW ABOUT LOVE (ALMOST)")).toBe(
      "EVERYTHING I KNOW ABOUT LOVE (ALMOST)"
    );
  });
});

describe("listGenres", () => {
  it("maps list names onto site genres", () => {
    expect(listGenres("hardcover-fiction")).toEqual(["Fiction"]);
    expect(listGenres("combined-print-and-e-book-nonfiction")).toEqual(["Non-Fiction"]);
    expect(listGenres("audio-nonfiction")).toEqual(["Non-Fiction"]);
    expect(listGenres("advice-how-to-and-miscellaneous")).toEqual(["Self-Help", "Non-Fiction"]);
    expect(listGenres("young-adult-hardcover")).toEqual(["Young Adult"]);
    expect(listGenres("middle-grade-paperback-monthly")).toEqual(["Children"]);
    expect(listGenres("graphic-books-and-manga")).toEqual(["Graphic Novel"]);
    expect(listGenres("mass-market-monthly")).toEqual(["Fiction"]);
    expect(listGenres("science")).toEqual(["Science", "Non-Fiction"]);
    expect(listGenres("something-new")).toEqual([]);
  });
});
