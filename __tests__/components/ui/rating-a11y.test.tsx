/**
 * Accessibility of the rating primitives (Phase 2, Task 20).
 *
 * Stars used to be five bare SVGs with no text alternative, and `Input`
 * never told assistive tech that a field was invalid.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RatingDisplay } from "@/components/ui/rating-display";
import { Input } from "@/components/ui/input";

beforeEach(cleanup);

describe("RatingDisplay", () => {
  it("is one image with the rating as its name; the glyphs are hidden", () => {
    const { container } = render(<RatingDisplay rating={4.5} count={12} />);
    const img = screen.getByRole("img", { name: "4.5 out of 5" });
    expect(img).toBeTruthy();
    expect(container.querySelectorAll("svg").length).toBe(6); // 5 + the half overlay
    const glyphs = Array.from(img.children);
    expect(glyphs.length).toBe(5);
    expect(glyphs.every((g) => g.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(screen.getByText("(12)")).toBeTruthy();
  });

  it("names the source and shows the OL tag for an Open Library figure", () => {
    render(<RatingDisplay rating={3.9} source="external" />);
    expect(screen.getByRole("img", { name: "3.9 out of 5 on Open Library" })).toBeTruthy();
    expect(screen.getByTitle("Open Library rating").textContent).toBe("OL");
  });

  it("renders nothing without a rating", () => {
    const { container } = render(<RatingDisplay rating={null} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("Input", () => {
  it("sets aria-invalid only when the error prop is on", () => {
    render(
      <>
        <Input aria-label="ok" />
        <Input aria-label="bad" error aria-describedby="hint" />
      </>
    );
    expect(screen.getByLabelText("ok").getAttribute("aria-invalid")).toBeNull();
    const bad = screen.getByLabelText("bad");
    expect(bad.getAttribute("aria-invalid")).toBe("true");
    expect(bad.getAttribute("aria-describedby")).toBe("hint");
  });
});
