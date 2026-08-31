/**
 * Tests for the LLM result schemas (Task 22)
 *
 * These schemas are what `generateObject` enforces in the curated-picks and
 * trending-insights routes. The point of each rejection case below is that the
 * code they replaced ACCEPTED it: the old routes ran
 * `text.match(/\{[\s\S]*\}/)` + `JSON.parse`, and when that found nothing they
 * fell through to `responseText.slice(0, 80)` / `.slice(0, 100)` and rendered
 * the model's raw prose to the reader as a recommendation. Anything rejected
 * here now throws NoObjectGeneratedError inside the route, which is caught and
 * answered with a written fallback instead.
 */

import { describe, it, expect } from "vitest";
import { generateObject } from "ai";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import {
  curatedPickSchema,
  trendingInsightSchema,
} from "@/lib/ai/schemas";

describe("curatedPickSchema", () => {
  it("accepts a well-formed pick", () => {
    const result = curatedPickSchema.safeParse({
      reason: "Quiet, character-driven grief that echoes your recent reads.",
      matchType: "mood",
    });
    expect(result.success).toBe(true);
  });

  it("accepts every documented matchType", () => {
    for (const matchType of ["mood", "theme", "author", "genre", "vibe"]) {
      const result = curatedPickSchema.safeParse({ reason: "A fine read.", matchType });
      expect(result.success).toBe(true);
    }
  });

  describe("rejects what the old regex + JSON.parse path would have rendered", () => {
    it("rejects conversational prose with no object at all", () => {
      // Previously: no regex match -> reason = prose.slice(0, 80)
      const result = curatedPickSchema.safeParse(
        "Sure! Here's a recommendation for this reader:"
      );
      expect(result.success).toBe(false);
    });

    it("rejects an object that omits reason", () => {
      const result = curatedPickSchema.safeParse({ matchType: "genre" });
      expect(result.success).toBe(false);
    });

    it("rejects an empty reason", () => {
      // Previously: `parsed.reason || "A great read for you"` silently masked this
      const result = curatedPickSchema.safeParse({ reason: "", matchType: "genre" });
      expect(result.success).toBe(false);
    });

    it("rejects a matchType outside the union", () => {
      // Previously: `parsed.matchType || "genre"` passed "vibes"/"emotional"
      // straight through to the client as a match type it does not handle.
      const result = curatedPickSchema.safeParse({
        reason: "A fine read.",
        matchType: "emotional",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a reason longer than the blurb slot", () => {
      const result = curatedPickSchema.safeParse({
        reason: "x".repeat(201),
        matchType: "genre",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("trendingInsightSchema", () => {
  it("accepts a well-formed insight", () => {
    const result = trendingInsightSchema.safeParse({
      insight: "Readers keep returning to its unhurried middle section.",
      keywords: ["slow-burn", "atmospheric"],
    });
    expect(result.success).toBe(true);
  });

  describe("rejects what the old regex + JSON.parse path would have rendered", () => {
    it("rejects conversational prose with no object at all", () => {
      // Previously: no regex match -> insight = prose.slice(0, 100)
      const result = trendingInsightSchema.safeParse(
        "Of course — here is a trending insight based on those reviews:"
      );
      expect(result.success).toBe(false);
    });

    it("rejects missing keywords", () => {
      const result = trendingInsightSchema.safeParse({ insight: "Still resonating." });
      expect(result.success).toBe(false);
    });

    it("rejects an empty keywords array", () => {
      // Previously: `parsed.keywords || []` made an empty list indistinguishable
      // from a model that returned none.
      const result = trendingInsightSchema.safeParse({
        insight: "Still resonating.",
        keywords: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects more keywords than the UI shows", () => {
      const result = trendingInsightSchema.safeParse({
        insight: "Still resonating.",
        keywords: ["a", "b", "c", "d"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-string keywords", () => {
      const result = trendingInsightSchema.safeParse({
        insight: "Still resonating.",
        keywords: [1, 2],
      });
      expect(result.success).toBe(false);
    });

    it("rejects an insight longer than the slot", () => {
      const result = trendingInsightSchema.safeParse({
        insight: "x".repeat(241),
        keywords: ["long"],
      });
      expect(result.success).toBe(false);
    });
  });
});

/**
 * The link between "the schema rejects it" and "the route falls back": these
 * drive the real `generateObject` with a mock model, so they prove the SDK
 * turns a schema violation into a throw rather than handing the route a
 * half-valid object. The routes wrap each call in try/catch and answer with a
 * written fallback, so a throw here is exactly what makes the fallback fire.
 */
describe("generateObject enforces the schemas at runtime", () => {
  // Hand-rolled rather than `MockLanguageModelV2` from "ai/test": that entry
  // point pulls in `msw`, which this project does not depend on, and the
  // interface needed here is four fields.
  const respondWith = (text: string): LanguageModelV2 => ({
    specificationVersion: "v2",
    provider: "test",
    modelId: "test-model",
    supportedUrls: {},
    doGenerate: async () => ({
      finishReason: "stop" as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content: [{ type: "text" as const, text }],
      warnings: [],
    }),
    doStream: async () => {
      throw new Error("not used");
    },
  });

  it("returns the object when the model answers in shape", async () => {
    const { object } = await generateObject({
      model: respondWith(
        JSON.stringify({ reason: "Quiet grief, like your recent reads.", matchType: "mood" })
      ),
      schema: curatedPickSchema,
      prompt: "irrelevant",
    });
    expect(object).toEqual({
      reason: "Quiet grief, like your recent reads.",
      matchType: "mood",
    });
  });

  it("throws on conversational prose instead of yielding sliced chatter", async () => {
    // The old path rendered `"Sure! Here's a rec...".slice(0, 80)` to the reader.
    await expect(
      generateObject({
        model: respondWith("Sure! Here's a recommendation for this reader:"),
        schema: curatedPickSchema,
        prompt: "irrelevant",
      })
    ).rejects.toThrow();
  });

  it("throws on a matchType outside the union", async () => {
    await expect(
      generateObject({
        model: respondWith(
          JSON.stringify({ reason: "A fine read.", matchType: "emotional" })
        ),
        schema: curatedPickSchema,
        prompt: "irrelevant",
      })
    ).rejects.toThrow();
  });

  it("throws when trending keywords are missing", async () => {
    await expect(
      generateObject({
        model: respondWith(JSON.stringify({ insight: "Still resonating." })),
        schema: trendingInsightSchema,
        prompt: "irrelevant",
      })
    ).rejects.toThrow();
  });
});
