import { describe, it, expect, vi, afterEach } from "vitest";

const readBook = {
  id: "ub1",
  status: "read",
  started_at: null,
  finished_at: "2026-02-15T12:00:00",
  created_at: "2026-02-01T12:00:00",
  book: { id: "b1", title: "T", slug: "t", author: "A", page_count: 200, published_date: null, genres: [], cover_url: null },
};

// Chainable stand-in: every query method returns the builder; awaiting it
// yields the user's one read book for user_books and nothing elsewhere.
function builder(table: string) {
  const result = { data: table === "user_books" ? [readBook] : [], error: null };
  const b: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => resolve(result),
    single: async () => ({ data: null, error: null }),
  };
  for (const m of ["select", "eq", "order", "range", "overrideTypes"]) {
    b[m] = () => b;
  }
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (t: string) => builder(t) }),
}));

import { getUserReadingStats } from "@/lib/queries/stats";

afterEach(() => {
  vi.useRealTimers();
});

describe("getUserReadingStats monthly buckets", () => {
  it("lists 12 distinct months when today is the 31st", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 2, 31, 12)); // Mar 31: setMonth(-1) overflowed Feb

    const { monthlyReading } = await getUserReadingStats("u1");

    const months = monthlyReading.map((m) => m.month);
    expect(new Set(months).size).toBe(12);
    expect(months[0]).toBe("Apr 25");
    expect(months[11]).toBe("Mar 26");
    expect(monthlyReading.find((m) => m.month === "Feb 26")?.books).toBe(1);
  });
});
