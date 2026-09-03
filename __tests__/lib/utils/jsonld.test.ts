import { describe, it, expect } from "vitest";
import { safeJsonLd, jsonLdScriptProps } from "@/lib/utils/jsonld";

describe("safeJsonLd", () => {
  it("cannot be broken out of with a closing script tag", () => {
    const out = safeJsonLd({ name: 'x</script><script>alert("1")</script>' });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).toContain("\\u003c/script\\u003e");
  });

  it("escapes ampersands and stays valid JSON that round-trips", () => {
    const input = { title: "Tom & Jerry <3", nested: { list: ["a>b", 1, null, true] } };
    const out = safeJsonLd(input);
    expect(out).not.toContain("&");
    expect(JSON.parse(out)).toEqual(input);
  });

  it("jsonLdScriptProps wraps the same string for a <script> element", () => {
    const props = jsonLdScriptProps({ "@type": "Book", name: "<b>" });
    expect(props.type).toBe("application/ld+json");
    expect(props.dangerouslySetInnerHTML.__html).toBe(safeJsonLd({ "@type": "Book", name: "<b>" }));
  });
});
