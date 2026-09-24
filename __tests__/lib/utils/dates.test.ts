import { describe, it, expect, afterEach } from "vitest";
import { toLocalDateString, challengeWindow } from "@/lib/utils/dates";

const originalTZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTZ;
});

describe("toLocalDateString", () => {
  it.each(["Europe/Warsaw", "America/Los_Angeles", "Pacific/Auckland", "UTC"])(
    "keeps the local calendar day in %s",
    (tz) => {
      process.env.TZ = tz;
      // Month-range bounds the create form builds
      expect(toLocalDateString(new Date(2026, 8, 1))).toBe("2026-09-01");
      expect(toLocalDateString(new Date(2026, 9, 0))).toBe("2026-09-30");
      expect(toLocalDateString(new Date(2026, 11, 31))).toBe("2026-12-31");
    }
  );
});

describe("challengeWindow", () => {
  const sep = (now: string) =>
    challengeWindow("2026-09-01", "2026-09-30", new Date(now));

  it("counts books finished at any time on the end date", () => {
    const w = sep("2026-09-15T12:00:00Z");
    expect(w.contains("2026-09-30T23:59:59Z")).toBe(true);
    expect(w.contains("2026-09-01T00:00:00Z")).toBe(true);
    expect(w.contains("2026-10-01T00:00:00Z")).toBe(false);
    expect(w.contains("2026-08-31T23:59:59Z")).toBe(false);
    expect(w.totalDays).toBe(30);
  });

  it("is not over on the end date, nor the day after", () => {
    expect(sep("2026-09-30T20:00:00Z").isOver).toBe(false);
    expect(sep("2026-09-30T20:00:00Z").daysRemaining).toBe(1);
    expect(sep("2026-10-01T11:00:00Z").isOver).toBe(false);
    expect(sep("2026-10-02T00:00:00Z").isOver).toBe(true);
  });

  it("does not depend on the server timezone", () => {
    for (const tz of ["Europe/Warsaw", "America/Los_Angeles"]) {
      process.env.TZ = tz;
      const w = sep("2026-09-30T20:00:00Z");
      expect(w.contains("2026-09-30T23:00:00Z")).toBe(true);
      expect(w.daysRemaining).toBe(1);
      expect(w.isOver).toBe(false);
    }
  });

  it("reports elapsed days, never negative before the start", () => {
    expect(sep("2026-09-11T00:00:00Z").daysElapsed).toBe(10);
    expect(sep("2026-08-20T00:00:00Z").daysElapsed).toBe(0);
  });
});
