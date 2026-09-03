/**
 * OSM Opening Hours Parser
 * Parses OpenStreetMap opening_hours format and determines open/closed status
 *
 * Format examples:
 * - "Mo-Fr 09:00-18:00"
 * - "Mo-Fr 09:00-18:00; Sa 10:00-14:00"
 * - "24/7"
 * - "Mo-Su 08:00-22:00"
 */

// Day name mappings (OSM uses 2-letter abbreviations)
const DAY_MAP: Record<string, number> = {
  Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6,
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ABBREVS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface TimeRange {
  open: number; // minutes from midnight
  close: number; // minutes from midnight
}

interface DaySchedule {
  day: number;
  ranges: TimeRange[];
}

interface ParsedHours {
  schedules: DaySchedule[];
  is24_7: boolean;
  raw: string;
}

/**
 * Parse time string like "09:00" to minutes from midnight
 */
function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

/**
 * Parse day range like "Mo-Fr" or single day "Sa"
 */
function parseDays(dayStr: string): number[] {
  const days: number[] = [];

  // Handle range like "Mo-Fr"
  if (dayStr.includes("-")) {
    const [start, end] = dayStr.split("-");
    const startDay = DAY_MAP[start];
    const endDay = DAY_MAP[end];

    if (startDay !== undefined && endDay !== undefined) {
      let current = startDay;
      while (true) {
        days.push(current);
        if (current === endDay) break;
        current = (current + 1) % 7;
      }
    }
  } else {
    // Single day
    const day = DAY_MAP[dayStr];
    if (day !== undefined) {
      days.push(day);
    }
  }

  return days;
}

/**
 * Parse OSM opening_hours string
 */
export function parseOpeningHours(hoursStr: string): ParsedHours | null {
  if (!hoursStr) return null;

  const raw = hoursStr.trim();

  // Handle 24/7
  if (raw === "24/7") {
    return {
      schedules: DAY_NAMES.map((_, i) => ({
        day: i,
        ranges: [{ open: 0, close: 1440 }], // 0:00 to 24:00
      })),
      is24_7: true,
      raw,
    };
  }

  const schedules: DaySchedule[] = [];

  // Split by semicolon for multiple rules
  const rules = raw.split(";").map((r) => r.trim());

  for (const rule of rules) {
    // Skip empty or complex rules we can't parse
    if (!rule || rule.includes("PH") || rule.includes("off")) continue;

    // Match pattern: "Mo-Fr 09:00-18:00" or "Sa 10:00-14:00,16:00-20:00"
    const match = rule.match(/^([A-Za-z,-]+)\s+([\d:,-]+)$/);
    if (!match) continue;

    const [, dayPart, timePart] = match;

    // Parse days (handle comma-separated like "Mo,We,Fr")
    const dayGroups = dayPart.split(",");
    const allDays: number[] = [];
    for (const dg of dayGroups) {
      allDays.push(...parseDays(dg.trim()));
    }

    // Parse time ranges (handle comma-separated like "09:00-12:00,14:00-18:00")
    const timeRanges: TimeRange[] = [];
    const timeGroups = timePart.split(",");
    for (const tg of timeGroups) {
      const [openTime, closeTime] = tg.trim().split("-");
      if (openTime && closeTime) {
        const open = parseTime(openTime);
        let close = parseTime(closeTime);
        // "22:00-02:00" closes the next morning: keep the range monotonic by
        // pushing the close past midnight (minute 1440 = 24:00).
        if (close <= open) close += 1440;
        timeRanges.push({ open, close });
      }
    }

    // Create schedule entries
    for (const day of allDays) {
      const existing = schedules.find((s) => s.day === day);
      if (existing) {
        existing.ranges.push(...timeRanges);
      } else {
        schedules.push({ day, ranges: [...timeRanges] });
      }
    }
  }

  return schedules.length > 0 ? { schedules, is24_7: false, raw } : null;
}

/**
 * Check if a place is currently open
 */
export function isOpenNow(hoursStr: string | null): { isOpen: boolean; nextChange?: string } | null {
  if (!hoursStr) return null;

  const parsed = parseOpeningHours(hoursStr);
  if (!parsed) return null;

  if (parsed.is24_7) {
    return { isOpen: true };
  }

  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const todaySchedule = parsed.schedules.find((s) => s.day === currentDay);

  const closesAt = (close: number) => {
    const closeHour = Math.floor((close % 1440) / 60);
    const closeMin = close % 60;
    return `Closes at ${closeHour}:${closeMin.toString().padStart(2, "0")}`;
  };

  // A range that started yesterday and runs past midnight (close > 1440) is
  // still going in the small hours of today.
  const yesterday = parsed.schedules.find((s) => s.day === (currentDay + 6) % 7);
  for (const range of yesterday?.ranges ?? []) {
    if (range.close > 1440 && currentMinutes + 1440 < range.close) {
      return { isOpen: true, nextChange: closesAt(range.close) };
    }
  }

  if (!todaySchedule || todaySchedule.ranges.length === 0) {
    return { isOpen: false, nextChange: findNextOpenTime(parsed.schedules, currentDay, currentMinutes) };
  }

  for (const range of todaySchedule.ranges) {
    if (currentMinutes >= range.open && currentMinutes < range.close) {
      return { isOpen: true, nextChange: closesAt(range.close) };
    }
  }

  // Not currently open - find next opening
  return { isOpen: false, nextChange: findNextOpenTime(parsed.schedules, currentDay, currentMinutes) };
}

/**
 * Find the next time the place opens
 */
function findNextOpenTime(schedules: DaySchedule[], currentDay: number, currentMinutes: number): string | undefined {
  // Check remaining times today
  const todaySchedule = schedules.find((s) => s.day === currentDay);
  if (todaySchedule) {
    for (const range of todaySchedule.ranges.sort((a, b) => a.open - b.open)) {
      if (range.open > currentMinutes) {
        const openHour = Math.floor(range.open / 60);
        const openMin = range.open % 60;
        return `Opens at ${openHour}:${openMin.toString().padStart(2, "0")}`;
      }
    }
  }

  // Check upcoming days
  for (let i = 1; i <= 7; i++) {
    const checkDay = (currentDay + i) % 7;
    const daySchedule = schedules.find((s) => s.day === checkDay);
    if (daySchedule && daySchedule.ranges.length > 0) {
      const firstRange = daySchedule.ranges.sort((a, b) => a.open - b.open)[0];
      const openHour = Math.floor(firstRange.open / 60);
      const openMin = firstRange.open % 60;
      if (i === 1) {
        return `Opens tomorrow at ${openHour}:${openMin.toString().padStart(2, "0")}`;
      }
      return `Opens ${DAY_ABBREVS[checkDay]} at ${openHour}:${openMin.toString().padStart(2, "0")}`;
    }
  }

  return undefined;
}

/**
 * Format hours for display (condensed format)
 */
export function formatHoursForDisplay(hoursStr: string | null): string[] | null {
  if (!hoursStr) return null;

  const parsed = parseOpeningHours(hoursStr);
  if (!parsed) return null;

  if (parsed.is24_7) {
    return ["Open 24 hours"];
  }

  // Group consecutive days with same hours
  const lines: string[] = [];
  const daysByHours = new Map<string, number[]>();

  for (const schedule of parsed.schedules) {
    const hoursKey = schedule.ranges
      .map((r) => `${formatMinutes(r.open)}-${formatMinutes(r.close)}`)
      .join(", ");

    if (!daysByHours.has(hoursKey)) {
      daysByHours.set(hoursKey, []);
    }
    daysByHours.get(hoursKey)!.push(schedule.day);
  }

  for (const [hours, days] of daysByHours) {
    days.sort((a, b) => a - b);
    const dayStr = formatDayRange(days);
    lines.push(`${dayStr}: ${hours}`);
  }

  return lines.length > 0 ? lines : null;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24; // a close past midnight displays as 2:00
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function formatDayRange(days: number[]): string {
  if (days.length === 1) {
    return DAY_ABBREVS[days[0]];
  }

  // Check if consecutive
  let isConsecutive = true;
  for (let i = 1; i < days.length; i++) {
    if (days[i] !== days[i - 1] + 1) {
      isConsecutive = false;
      break;
    }
  }

  if (isConsecutive && days.length > 2) {
    return `${DAY_ABBREVS[days[0]]}-${DAY_ABBREVS[days[days.length - 1]]}`;
  }

  return days.map((d) => DAY_ABBREVS[d]).join(", ");
}
