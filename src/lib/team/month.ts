import {
  addDays,
  addMonths,
  format,
  getISOWeek,
  isSaturday,
  isSunday,
  isWeekend,
  parseISO,
  startOfMonth,
} from "date-fns";
import { isoDate, mondayIso } from "@/lib/team/week";

export const DEMO_MONTH_START = "2026-08-01";

export type BoardView = "month" | "week";

export function monthStartIso(from: Date | string): string {
  const date = typeof from === "string" ? parseISO(from) : from;
  return isoDate(startOfMonth(date));
}

export function shiftMonth(monthStart: string, months: number): string {
  return isoDate(addMonths(parseISO(monthStart), months));
}

export function monthLabel(monthStart: string): string {
  return format(parseISO(monthStart), "MMMM yyyy").toUpperCase();
}

export function dateInMonth(date: string, monthStart: string): boolean {
  return date.slice(0, 7) === monthStart.slice(0, 7);
}

export function monthDays(monthStart: string, includeWeekends: boolean): Date[] {
  const start = parseISO(monthStart);
  const days: Date[] = [];
  let cursor = start;
  while (cursor.getMonth() === start.getMonth()) {
    if (includeWeekends || !isWeekend(cursor)) days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function monthWorkingIsoDates(monthStart: string, includeWeekends = false): string[] {
  return monthDays(monthStart, includeWeekends).map(isoDate);
}

export function isWeekStartColumn(date: Date): boolean {
  return format(date, "i") === "1";
}

export function weekGroupLabel(date: Date): string {
  return `WEEK ${getISOWeek(date)}`;
}

export function nearestVisibleDate(target: string, visibleDates: string[]): string | null {
  if (visibleDates.length === 0) return null;
  if (visibleDates.includes(target)) return target;
  const earlier = [...visibleDates].reverse().find((date) => date <= target);
  if (earlier) return earlier;
  return visibleDates.find((date) => date >= target) ?? visibleDates[0];
}

export function scrollAnchorForMonth(monthStart: string, includeWeekends: boolean, today = new Date()): string {
  const visible = monthWorkingIsoDates(monthStart, includeWeekends);
  if (monthStartIso(today) === monthStart) {
    return nearestVisibleDate(isoDate(today), visible) ?? visible[0];
  }
  return visible[0] ?? monthStart;
}

export function previousWeekdayIso(date: string): string {
  let cursor = parseISO(date);
  while (isSaturday(cursor) || isSunday(cursor)) {
    cursor = addDays(cursor, -1);
  }
  return isoDate(cursor);
}

export function monthColumnLabel(date: Date): { day: string; date: string } {
  return {
    day: format(date, "EEE").toUpperCase(),
    date: format(date, "dd MMM").toUpperCase(),
  };
}

export function weekStartForDate(date: string): string {
  return mondayIso(date);
}
