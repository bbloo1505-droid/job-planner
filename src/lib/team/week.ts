import {
  addDays,
  addWeeks,
  format,
  parseISO,
  startOfWeek,
} from "date-fns";

export const DEMO_WEEK_MONDAY = "2026-08-31";

export function mondayIso(from: Date | string): string {
  const date = typeof from === "string" ? parseISO(from) : from;
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function isoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function weekDays(mondayIsoDate: string): Date[] {
  const monday = parseISO(mondayIsoDate);
  return [0, 1, 2, 3, 4].map((offset) => addDays(monday, offset));
}

export function shiftWeek(mondayIsoDate: string, weeks: number): string {
  return isoDate(addWeeks(parseISO(mondayIsoDate), weeks));
}

export function weekRangeLabel(mondayIsoDate: string): string {
  const days = weekDays(mondayIsoDate);
  const start = days[0];
  const end = days[4];
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, "d MMM")} – ${format(end, "d MMM")}`;
  }
  return `${format(start, "d MMM")} – ${format(end, "d MMM")}`;
}

export function columnLabel(date: Date): { day: string; date: string } {
  return {
    day: format(date, "EEE").toUpperCase(),
    date: format(date, "d MMM").toUpperCase(),
  };
}
