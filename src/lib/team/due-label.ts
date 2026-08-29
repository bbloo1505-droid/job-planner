import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import { safeDate } from "@/lib/format";

export function dueStateLabel(
  dueDate: string | undefined,
  today = new Date(),
  plannerMonday?: string
): string | null {
  const due = dueDate ? safeDate(dueDate) : null;
  if (!due) return null;
  if (isSameDay(due, today)) return "Due today";
  if (due < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    return "Overdue";
  }
  const weekStart = plannerMonday
    ? parseISO(plannerMonday)
    : startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  if (due >= weekStart && due <= weekEnd) {
    return `Due ${format(due, "EEE")}`;
  }
  const nextWeekEnd = addDays(weekStart, 13);
  if (due <= nextWeekEnd) return "Due next week";
  return `Due ${format(due, "d MMM")}`;
}
