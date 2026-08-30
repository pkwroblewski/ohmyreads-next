/**
 * Tests for input sanitization helpers.
 *
 * escapeHtml guards the hand-built transactional email templates, which are raw
 * template literals sent to Resend and therefore not escaped by React.
 */

import { describe, it, expect } from "vitest";
import { escapeHtml, sanitizePostgrestValue } from "@/lib/utils/sanitize";
import { getWelcomeEmailHtml } from "@/lib/email/templates/welcome";

describe("escapeHtml", () => {
  it("neutralizes tag delimiters", () => {
    expect(escapeHtml("<img src=x onerror=alert(1)>")).toBe(
      "&lt;img src=x onerror=alert(1)&gt;"
    );
  });

  it("escapes quotes so attribute contexts cannot be broken out of", () => {
    expect(escapeHtml(`"onmouseover="evil()`)).toBe(
      "&quot;onmouseover=&quot;evil()"
    );
    expect(escapeHtml("O'Brien")).toBe("O&#39;Brien");
  });

  it("escapes ampersands first so entities are not double-encoded", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
    // A literal "&lt;" typed by a user stays literal rather than becoming "<"
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeHtml("Ada Lovelace")).toBe("Ada Lovelace");
    expect(escapeHtml("")).toBe("");
  });
});

describe("welcome email template", () => {
  it("renders an injected display name as inert text", () => {
    const html = getWelcomeEmailHtml({
      username: "attacker",
      displayName: '<img src=x onerror=alert(1)>',
    });

    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("escapes a malicious username when no display name is set", () => {
    const html = getWelcomeEmailHtml({
      username: '</a><script>alert(1)</script>',
    });

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("still renders a normal name readably", () => {
    const html = getWelcomeEmailHtml({
      username: "paul",
      displayName: "Paul",
    });

    expect(html).toContain("Welcome, Paul!");
  });
});

describe("sanitizePostgrestValue", () => {
  it("strips PostgREST structural characters", () => {
    expect(sanitizePostgrestValue("malicious.ilike,admin")).toBe(
      "maliciousilikeadmin"
    );
    expect(sanitizePostgrestValue("normal search")).toBe("normal search");
  });

  it("defuses a filter-injection payload", () => {
    // Attempts to close the ilike filter and append an is_admin filter.
    const payload = "),is_admin.eq.true,(";
    const safe = sanitizePostgrestValue(payload);

    for (const structural of [".", ",", "(", ")"]) {
      expect(safe).not.toContain(structural);
    }

    // The rebuilt filter string keeps exactly two comma-separated clauses.
    const filter = `username.ilike.%${safe}%,display_name.ilike.%${safe}%`;
    expect(filter.split(",")).toHaveLength(2);
  });

  it("strips quoting and escape characters", () => {
    expect(sanitizePostgrestValue(`a"b'c\\d`)).toBe("abcd");
  });

  it("strips the % wildcard so a term cannot match everything", () => {
    expect(sanitizePostgrestValue("%")).toBe("");
    expect(sanitizePostgrestValue("%admin%")).toBe("admin");
  });

  it("preserves underscores so username search keeps working", () => {
    // `_` is a single-char LIKE wildcard, but stripping it would break search
    // for the many usernames that contain one.
    expect(sanitizePostgrestValue("john_doe")).toBe("john_doe");
    expect(sanitizePostgrestValue("user_1a2b")).toBe("user_1a2b");
  });

  it("leaves ordinary search terms intact", () => {
    expect(sanitizePostgrestValue("Olga Tokarczuk")).toBe("Olga Tokarczuk");
  });
});
