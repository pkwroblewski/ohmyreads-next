/**
 * OSM opening-hours parsing and the "open now" check (Phase 2, Task 21).
 * `isOpenNow` reads the wall clock, so these pin it with fake timers.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { parseOpeningHours, isOpenNow } from "@/lib/utils/opening-hours";

/** Local time on a known weekday: 2026-09-04 is a Friday. */
function at(day: "Fri" | "Sat" | "Sun" | "Mon", hhmm: string) {
  const date = { Fri: 4, Sat: 5, Sun: 6, Mon: 7 }[day];
  const [h, m] = hhmm.split(":").map(Number);
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, date, h, m, 0));
}

afterEach(() => vi.useRealTimers());

describe("parseOpeningHours", () => {
  it("expands day ranges, comma lists and multiple time ranges", () => {
    const parsed = parseOpeningHours("Mo-Fr 09:00-12:00,13:00-18:00; Sa,Su 10:00-14:00");
    expect(parsed?.is24_7).toBe(false);
    expect(parsed?.schedules.find((s) => s.day === 1)?.ranges).toEqual([
      { open: 540, close: 720 },
      { open: 780, close: 1080 },
    ]);
    expect(parsed?.schedules.find((s) => s.day === 0)?.ranges).toEqual([{ open: 600, close: 840 }]);
    expect(parsed?.schedules.map((s) => s.day).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("treats 24/7 as open every day and returns null for junk", () => {
    expect(parseOpeningHours("24/7")?.is24_7).toBe(true);
    expect(parseOpeningHours("")).toBeNull();
    expect(parseOpeningHours("by appointment")).toBeNull();
    expect(parseOpeningHours("PH off")).toBeNull();
  });
});

describe("isOpenNow", () => {
  it("is open inside a range and reports the closing time", () => {
    at("Fri", "10:30");
    expect(isOpenNow("Mo-Fr 09:00-18:00")).toEqual({ isOpen: true, nextChange: "Closes at 18:00" });
  });

  it("is closed after hours and points at the next opening, today or later", () => {
    at("Fri", "08:00");
    expect(isOpenNow("Mo-Fr 09:00-18:00")).toEqual({ isOpen: false, nextChange: "Opens at 9:00" });
    at("Fri", "19:00");
    expect(isOpenNow("Mo-Fr 09:00-18:00; Sa 10:00-14:00")).toEqual({
      isOpen: false,
      nextChange: "Opens tomorrow at 10:00",
    });
    at("Sat", "15:00");
    expect(isOpenNow("Mo-Fr 09:00-18:00")).toEqual({ isOpen: false, nextChange: "Opens Mon at 9:00" });
  });

  it("handles a range that crosses midnight on both sides of it", () => {
    // Friday 22:00 → Saturday 02:00. At 23:30 Friday and at 01:00 Saturday the
    // bar is open; at 03:00 Saturday it is closed.
    at("Fri", "23:30");
    expect(isOpenNow("Fr 22:00-02:00")?.isOpen).toBe(true);
    at("Sat", "01:00");
    expect(isOpenNow("Fr 22:00-02:00")?.isOpen).toBe(true);
    at("Sat", "03:00");
    expect(isOpenNow("Fr 22:00-02:00")?.isOpen).toBe(false);
  });

  it("returns null with no hours and always open for 24/7", () => {
    at("Fri", "03:00");
    expect(isOpenNow(null)).toBeNull();
    expect(isOpenNow("nonsense")).toBeNull();
    expect(isOpenNow("24/7")).toEqual({ isOpen: true });
  });
});
