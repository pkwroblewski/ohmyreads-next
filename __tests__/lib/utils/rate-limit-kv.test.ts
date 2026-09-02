// @vitest-environment node
/**
 * Tests for the distributed (Vercel KV) rate-limit path (Task 28).
 *
 * The existing rate-limit suite only exercises `checkRateLimitSync`, the
 * in-memory fallback. That fallback is per-instance, so on serverless it is not
 * a rate limit at all — the real one is this path, and its most important
 * property is the one that only shows up when KV is broken: in production a KV
 * failure must **deny**, because falling back to per-instance counting would
 * let a distributed caller multiply their allowance by the number of
 * instances.
 *
 * `isKVConfigured` and `isProduction` are read once at module load, so each
 * case re-imports the module under the env it means to test.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const pipelineExec = vi.fn();
const incr = vi.fn();
const ttl = vi.fn();
const expire = vi.fn();
const loggerError = vi.fn();

vi.mock("@/lib/utils/log", () => ({
  logger: {
    error: (...args: unknown[]) => loggerError(...args),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@vercel/kv", () => ({
  kv: {
    pipeline: () => ({ incr, ttl, exec: pipelineExec }),
    expire,
    del: vi.fn(),
    get: vi.fn(),
  },
}));

async function loadRateLimit({
  kv: kvConfigured,
  nodeEnv,
}: {
  kv: boolean;
  nodeEnv: string;
}) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("KV_REST_API_URL", kvConfigured ? "https://kv.example" : "");
  vi.stubEnv("KV_REST_API_TOKEN", kvConfigured ? "kv-token" : "");
  return import("@/lib/utils/rate-limit");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("checkRateLimit with KV configured", () => {
  it("allows a request under the limit and reports what is left", async () => {
    const { checkRateLimit } = await loadRateLimit({
      kv: true,
      nodeEnv: "production",
    });
    pipelineExec.mockResolvedValue([3, 42]);

    const result = await checkRateLimit("search:1.2.3.4", 10, 60000);

    expect(result).toEqual({ allowed: true, remaining: 7, resetIn: 42000 });
  });

  it("denies once the count passes the limit", async () => {
    const { checkRateLimit } = await loadRateLimit({
      kv: true,
      nodeEnv: "production",
    });
    pipelineExec.mockResolvedValue([11, 30]);

    const result = await checkRateLimit("search:1.2.3.4", 10, 60000);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("allows the request that exactly reaches the limit", async () => {
    const { checkRateLimit } = await loadRateLimit({
      kv: true,
      nodeEnv: "production",
    });
    pipelineExec.mockResolvedValue([10, 30]);

    expect((await checkRateLimit("search:1.2.3.4", 10, 60000)).allowed).toBe(
      true
    );
  });

  it("sets an expiry when the key has none, so a counter cannot get stuck", async () => {
    const { checkRateLimit } = await loadRateLimit({
      kv: true,
      nodeEnv: "production",
    });
    // -2 means the key did not exist before INCR created it.
    pipelineExec.mockResolvedValue([1, -2]);

    const result = await checkRateLimit("search:1.2.3.4", 10, 60000);

    expect(expire).toHaveBeenCalledWith("ratelimit:search:1.2.3.4", 60);
    expect(result.resetIn).toBe(60000);
  });

  it("namespaces its keys so they cannot collide with other KV data", async () => {
    const { checkRateLimit } = await loadRateLimit({
      kv: true,
      nodeEnv: "production",
    });
    pipelineExec.mockResolvedValue([1, 60]);

    await checkRateLimit("admin:user-1", 30, 60000);

    expect(incr).toHaveBeenCalledWith("ratelimit:admin:user-1");
  });
});

describe("checkRateLimit when KV fails", () => {
  it("FAILS CLOSED in production", async () => {
    const { checkRateLimit } = await loadRateLimit({
      kv: true,
      nodeEnv: "production",
    });
    pipelineExec.mockRejectedValue(new Error("KV unreachable"));

    const result = await checkRateLimit("search:1.2.3.4", 10, 60000);

    // Denying here is the whole point. Falling back to in-memory counting
    // would hand a distributed caller one full allowance per instance.
    expect(result).toEqual({ allowed: false, remaining: 0, resetIn: 60000 });
  });

  it("falls back to in-memory counting outside production", async () => {
    const { checkRateLimit } = await loadRateLimit({
      kv: true,
      nodeEnv: "development",
    });
    pipelineExec.mockRejectedValue(new Error("KV unreachable"));

    const key = `dev-fallback-${Date.now()}`;
    const first = await checkRateLimit(key, 2, 60000);
    await checkRateLimit(key, 2, 60000);
    const third = await checkRateLimit(key, 2, 60000);

    expect(first.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });
});

describe("checkRateLimit without KV configured", () => {
  it("counts in memory in production and reports the missing KV once", async () => {
    const { checkRateLimit } = await loadRateLimit({
      kv: false,
      nodeEnv: "production",
    });

    // Production Vercel has no Redis store yet (phase-2 plan, Out of Scope:
    // "Provision Upstash Redis"), so refusing here would 429 every
    // rate-limited call. Until the store exists the per-instance map stays,
    // but the gap must be logged once per instance, not silently.
    const key = `no-kv-prod-${Date.now()}`;
    expect((await checkRateLimit(key, 2, 60000)).allowed).toBe(true);
    expect((await checkRateLimit(key, 2, 60000)).allowed).toBe(true);
    expect((await checkRateLimit(key, 2, 60000)).allowed).toBe(false);

    expect(incr).not.toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalledTimes(1);
    expect(loggerError.mock.calls[0][0]).toMatch(/KV_REST_API_URL/);
  });

  // Un-skip once KV_REST_API_URL / KV_REST_API_TOKEN exist in Vercel
  // production and `checkRateLimit()` returns `{ allowed: false }` for the
  // unconfigured-in-production case (see the deferred item in the plan).
  it.skip("FAILS CLOSED in production and says why once", async () => {
    const { checkRateLimit } = await loadRateLimit({
      kv: false,
      nodeEnv: "production",
    });

    const first = await checkRateLimit(`no-kv-prod-${Date.now()}`, 100, 60000);
    const second = await checkRateLimit(`no-kv-prod-2-${Date.now()}`, 100, 60000);

    expect(first).toEqual({ allowed: false, remaining: 0, resetIn: 60000 });
    expect(second.allowed).toBe(false);
    expect(incr).not.toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalledTimes(1);
    expect(loggerError.mock.calls[0][0]).toMatch(/KV_REST_API_URL/);
  });

  it("counts in memory outside production", async () => {
    const { checkRateLimit } = await loadRateLimit({
      kv: false,
      nodeEnv: "development",
    });

    const key = `no-kv-${Date.now()}`;
    expect((await checkRateLimit(key, 2, 60000)).allowed).toBe(true);
    expect((await checkRateLimit(key, 2, 60000)).allowed).toBe(true);
    expect((await checkRateLimit(key, 2, 60000)).allowed).toBe(false);

    // The KV client must not have been touched at all.
    expect(incr).not.toHaveBeenCalled();
  });
});

describe("getClientIp", () => {
  it("prefers the platform-set x-real-ip over the appendable header", async () => {
    const { getClientIp } = await loadRateLimit({
      kv: false,
      nodeEnv: "production",
    });

    const request = new Request("https://example.com", {
      headers: {
        "x-real-ip": "203.0.113.5",
        "x-forwarded-for": "1.1.1.1, 203.0.113.5",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.5");
  });

  it("takes the LAST x-forwarded-for entry, which the platform appends", async () => {
    const { getClientIp } = await loadRateLimit({
      kv: false,
      nodeEnv: "production",
    });

    // A caller can prepend anything they like to this header; only the final
    // value is written by the platform. Trusting the first would let anyone
    // pick their own rate-limit bucket.
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "9.9.9.9, 8.8.8.8, 203.0.113.5" },
    });

    expect(getClientIp(request)).toBe("203.0.113.5");
  });

  it("falls back to a constant when no IP header is present", async () => {
    const { getClientIp } = await loadRateLimit({
      kv: false,
      nodeEnv: "production",
    });

    expect(getClientIp(new Request("https://example.com"))).toBe("unknown");
  });
});
