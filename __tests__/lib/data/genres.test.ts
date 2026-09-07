import { describe, expect, it } from "vitest";
import {
  GENRES,
  GENRE_ALIASES,
  GENRE_TAGS,
  GENRE_VOCABULARY,
  genreKey,
  isGenre,
  normalizeGenres,
} from "@/lib/data/genres";

describe("genre vocabulary", () => {
  it("has no duplicates across genres and tags", () => {
    expect(new Set(GENRE_VOCABULARY).size).toBe(GENRES.length + GENRE_TAGS.length);
  });

  it("maps every vocabulary entry onto itself, in any case", () => {
    for (const genre of GENRE_VOCABULARY) {
      expect(normalizeGenres([genre])).toEqual([genre]);
      expect(normalizeGenres([genre.toUpperCase()])).toEqual([genre]);
    }
  });

  it("only ever aliases onto vocabulary entries, with lower-case keys", () => {
    for (const [key, targets] of Object.entries(GENRE_ALIASES)) {
      expect(key).toBe(genreKey(key));
      for (const target of targets) expect(isGenre(target)).toBe(true);
    }
  });
});

describe("normalizeGenres", () => {
  it("splits Google's slash categories and drops 'General'", () => {
    expect(normalizeGenres(["Fiction / Thrillers / General"])).toEqual(["Fiction", "Thriller"]);
    expect(normalizeGenres(["Juvenile Fiction / Animals / General"])).toEqual(["Children", "Fiction"]);
  });

  it("splits Open Library's comma subjects", () => {
    expect(normalizeGenres(["Magic, Fiction"])).toEqual(["Fantasy", "Fiction"]);
    expect(normalizeGenres(["Comic Books, Strips, Etc."])).toEqual(["Graphic Novel"]);
    expect(normalizeGenres(["World War, 1939-1945, Fiction"])).toEqual(["History", "Fiction"]);
  });

  it("drops noise entirely", () => {
    expect(
      normalizeGenres(["[document]", "11.93 Buddhism", "1835-1910", "Trump, Donald, 1946-", "", null, undefined])
    ).toEqual([]);
  });

  it("dedupes in first-seen order across sources", () => {
    expect(
      normalizeGenres(["Thriller", "Fiction, Thrillers, Suspense", "Nonfiction", "Non-Fiction", "Bestseller"])
    ).toEqual(["Thriller", "Fiction", "Non-Fiction", "Bestseller"]);
  });

  it("normalises spacing, apostrophes and trailing full stops in keys", () => {
    expect(normalizeGenres(["  Children’s   Fiction. "])).toEqual(["Children", "Fiction"]);
    expect(genreKey("Self-Help.")).toBe("self-help");
  });

  it("keeps award tags and expands multi-genre aliases", () => {
    expect(normalizeGenres(["Pulitzer Prize", "Romantasy"])).toEqual(["Pulitzer Prize", "Fantasy", "Romance"]);
  });
});
