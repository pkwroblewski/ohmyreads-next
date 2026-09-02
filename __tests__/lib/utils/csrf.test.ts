// @vitest-environment node
/**
 * Tests for Origin/Referer based CSRF protection (Task 28).
 *
 * `ALLOWED_ORIGINS` is computed once at module load from `NEXT_PUBLIC_SITE_URL`
 * and `NODE_ENV`, so every case here re-imports the module under the env it
 * means to test. That is also the point of several of them: the same request is
 * accepted in development and rejected in production.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Runs under the node environment on purpose: happy-dom applies browser Fetch
// semantics, where `Origin` and `Referer` are forbidden request headers and are
// silently dropped — which would make every case here look header-less and pass
// or fail for the wrong reason. This code only ever runs on the server anyway.

const SITE = "https://ohmyreads-next.vercel.app";

async function loadCsrf(nodeEnv: string, siteUrl: string | undefined = SITE) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  if (siteUrl === undefined) {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  } else {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
  }
  return import("@/lib/utils/csrf");
}

function req(
  url: string,
  headers: Record<string, string> = {}
): Request {
  return new Request(url, { headers });
}

describe("validateOrigin", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a request from the configured site origin", async () => {
    const { validateOrigin } = await loadCsrf("production");

    expect(validateOrigin(req(`${SITE}/api/x`, { origin: SITE }))).toBe(true);
  });

  it("rejects a request from another site", async () => {
    const { validateOrigin } = await loadCsrf("production");

    expect(
      validateOrigin(req(`${SITE}/api/x`, { origin: "https://evil.example" }))
    ).toBe(false);
  });

  it("falls back to the referer's origin when Origin is absent", async () => {
    const { validateOrigin } = await loadCsrf("production");

    expect(
      validateOrigin(req(`${SITE}/api/x`, { referer: `${SITE}/books/dune` }))
    ).toBe(true);
    expect(
      validateOrigin(
        req(`${SITE}/api/x`, { referer: "https://evil.example/attack" })
      )
    ).toBe(false);
  });

  it("prefers Origin over Referer when both are present", async () => {
    const { validateOrigin } = await loadCsrf("production");

    // A forged page can set its own Referer but not another site's Origin.
    expect(
      validateOrigin(
        req(`${SITE}/api/x`, {
          origin: "https://evil.example",
          referer: `${SITE}/books/dune`,
        })
      )
    ).toBe(false);
  });

  it("rejects a header-less request in production and allows it elsewhere", async () => {
    const prod = await loadCsrf("production");
    expect(prod.validateOrigin(req(`${SITE}/api/x`))).toBe(false);

    const dev = await loadCsrf("development");
    expect(dev.validateOrigin(req(`${SITE}/api/x`))).toBe(true);
  });

  it("trusts localhost only in development", async () => {
    const dev = await loadCsrf("development");
    expect(
      dev.validateOrigin(
        req("http://localhost:3000/api/x", { origin: "http://localhost:3000" })
      )
    ).toBe(true);

    const prod = await loadCsrf("production");
    expect(
      prod.validateOrigin(
        req(`${SITE}/api/x`, { origin: "http://localhost:3000" })
      )
    ).toBe(false);
  });

  it("rejects an origin that merely starts with the allowed one", async () => {
    const { validateOrigin } = await loadCsrf("production");

    expect(
      validateOrigin(
        req(`${SITE}/api/x`, {
          origin: "https://ohmyreads-next.vercel.app.evil.example",
        })
      )
    ).toBe(false);
  });
});

describe("isForeignOrigin", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets a header-less request through only when Sec-Fetch-Site says same-origin or none", async () => {
    const { isForeignOrigin } = await loadCsrf("production");

    // Same-origin fetches under a strict referrer policy, and typed URLs /
    // bookmarks, carry no Origin or Referer but do carry fetch metadata.
    expect(
      isForeignOrigin(
        req(`${SITE}/api/geo/x`, { "sec-fetch-site": "same-origin" })
      )
    ).toBe(false);
    expect(
      isForeignOrigin(req(`${SITE}/api/geo/x`, { "sec-fetch-site": "none" }))
    ).toBe(false);
  });

  it("flags a header-less request whose fetch metadata says cross-site", async () => {
    const { isForeignOrigin } = await loadCsrf("production");

    // `<img src=/api/geo/...>` on a foreign page with `no-referrer` sends
    // neither Origin nor Referer — but the browser still sets this header.
    expect(
      isForeignOrigin(
        req(`${SITE}/api/geo/x`, { "sec-fetch-site": "cross-site" })
      )
    ).toBe(true);
    expect(
      isForeignOrigin(
        req(`${SITE}/api/geo/x`, { "sec-fetch-site": "same-site" })
      )
    ).toBe(true);
  });

  it("flags a request with no origin information at all", async () => {
    const { isForeignOrigin } = await loadCsrf("production");

    // curl, server-to-server, old bots. These endpoints spend paid API
    // budget; only the site's own pages should be able to drive them.
    expect(isForeignOrigin(req(`${SITE}/api/geo/x`))).toBe(true);
  });

  it("accepts a request whose Origin host matches the request host", async () => {
    const { isForeignOrigin } = await loadCsrf("production", "");

    expect(
      isForeignOrigin(
        req("https://preview-xyz.vercel.app/api/geo/x", {
          origin: "https://preview-xyz.vercel.app",
        })
      )
    ).toBe(false);
  });

  it("flags a request from a different host", async () => {
    const { isForeignOrigin } = await loadCsrf("production");

    expect(
      isForeignOrigin(
        req(`${SITE}/api/geo/x`, { origin: "https://evil.example" })
      )
    ).toBe(true);
  });

  it("flags a malformed Origin such as the sandboxed-iframe `null`", async () => {
    const { isForeignOrigin } = await loadCsrf("production");

    expect(
      isForeignOrigin(req(`${SITE}/api/geo/x`, { origin: "null" }))
    ).toBe(true);
  });

  it("compares hosts, so port and scheme differences do not matter", async () => {
    const { isForeignOrigin } = await loadCsrf("production");

    expect(
      isForeignOrigin(
        req(`${SITE}/api/geo/x`, { origin: "http://ohmyreads-next.vercel.app" })
      )
    ).toBe(false);
  });

  it("falls back to Referer when Origin is absent", async () => {
    const { isForeignOrigin } = await loadCsrf("production");

    expect(
      isForeignOrigin(
        req(`${SITE}/api/geo/x`, { referer: "https://evil.example/page" })
      )
    ).toBe(true);
    expect(
      isForeignOrigin(
        req(`${SITE}/api/geo/x`, { referer: `${SITE}/community/map` })
      )
    ).toBe(false);
  });
});
