// @vitest-environment node
/**
 * GET /api/export (Phase 2, Task 21, T3).
 *
 * 401 without a session, 429 at the one-per-hour limit (with the wait in the
 * message), 400 for an unknown format, an attachment filename dated today for
 * both formats, and CSV cells that start with a formula trigger neutralised.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { tableRouter } from "../../helpers/mock-supabase";

const { checkRateLimit, logger } = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/utils/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/utils/log", () => ({
  logger,
  logError: vi.fn(),
  extractSupabaseErrorInfo: (e: unknown) => ({ error: e }),
}));

let user: { id: string } | null = { id: "550e8400-e29b-41d4-a716-446655440000" };
let router = tableRouter({});
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: router.from }),
  getUser: async () =>
    user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "nope" } },
}));

import { GET } from "@/app/api/export/route";

function req(query = "") {
  return new NextRequest(`https://ohmyreads.example/api/export${query}`);
}

const today = new Date().toISOString().split("T")[0];

beforeEach(() => {
  vi.clearAllMocks();
  user = { id: "550e8400-e29b-41d4-a716-446655440000" };
  checkRateLimit.mockResolvedValue({ allowed: true, remaining: 0, resetIn: 0 });
  router = tableRouter({
    profiles: { data: { username: "ada", display_name: "Ada" }, error: null },
    user_books: {
      data: [
        {
          status: "read",
          rating: 5,
          started_at: null,
          finished_at: "2026-01-02",
          created_at: "2026-01-01",
          book: { title: "=HYPERLINK(\"http://evil\")", author: "Frank, Herbert" },
        },
      ],
      error: null,
    },
    reviews: { data: [{ rating: 4, summary: "+1 great", content: "text", vibe_tags: ["cozy"], created_at: "2026-01-03", book: { title: "Dune", author: "FH" } }], error: null },
    user_taste_profiles: { data: null, error: { code: "PGRST116" } },
    reading_challenges: { data: [], error: null },
    user_badges: { data: [], error: null },
    follows: { data: [], error: null },
    reading_goals: { data: [{ year: 2026, target_books: 12 }], error: null },
  });
});

describe("GET /api/export", () => {
  it("answers 401 without a session and never queries", async () => {
    user = null;
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(router.from).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("answers 429 with the wait in minutes at the one-per-hour limit", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetIn: 25 * 60 * 1000 + 1 });
    const res = await GET(req());
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/26 minutes/);
    expect(checkRateLimit).toHaveBeenCalledWith(`export:${user!.id}`, 1, 3600000);
    expect(router.from).not.toHaveBeenCalled();
  });

  it("answers 400 for a format other than json or csv", async () => {
    const res = await GET(req("?format=xml"));
    expect(res.status).toBe(400);
    expect(router.from).not.toHaveBeenCalled();
  });

  it("returns a dated JSON attachment scoped to the caller", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Content-Disposition")).toBe(
      `attachment; filename="ohmyreads-export-${today}.json"`
    );
    const body = await res.json();
    expect(body.profile).toEqual({ username: "ada", display_name: "Ada" });
    expect(body.books).toHaveLength(1);
    expect(body.readingGoals).toEqual([{ year: 2026, target_books: 12 }]);
    expect(body.tasteProfile).toBeNull();
    expect(body.exportedAt).toEqual(expect.any(String));
    // every section filtered to the signed-in user
    for (const table of ["profiles", "user_books", "reviews", "reading_goals"]) {
      const eqs = router.calls[table][0].filter(([m]) => m === "eq").map(([, a]) => a);
      expect(eqs, table).toContainEqual([expect.stringMatching(/^(id|user_id)$/), user!.id]);
    }
    // a missing taste profile (PGRST116) is normal and not logged
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("returns CSV with formula cells neutralised and quoted commas intact", async () => {
    const res = await GET(req("?format=csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv");
    expect(res.headers.get("Content-Disposition")).toBe(`attachment; filename="ohmyreads-export-${today}.csv"`);
    const text = await res.text();
    expect(text).toContain("=== BOOKS ===");
    // The title started with "=": it must not reach the sheet as a formula.
    expect(text).not.toMatch(/\n=HYPERLINK/);
    expect(text).toMatch(/"'=HYPERLINK\(""http:\/\/evil""\)"/);
    expect(text).toContain('"Frank, Herbert"');
    expect(text).toContain(",'+1 great,"); // no comma inside, so no quoting
    expect(text).toContain("2026,12");
    expect(text).toContain("Exported at: ");
  });

  it("logs a section that failed instead of shipping a silently incomplete export", async () => {
    router = tableRouter({
      profiles: { data: { username: "ada" }, error: null },
      reviews: { data: null, error: { code: "42P01", message: "relation missing" } },
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(logger.error).toHaveBeenCalledWith(
      "Data export section failed",
      expect.objectContaining({ section: "reviews", userId: user!.id })
    );
    expect((await res.json()).reviews).toEqual([]);
  });
});
