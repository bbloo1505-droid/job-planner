import { parseISO } from "date-fns";
import { formatDisplayTime } from "@/lib/routing/round-time";
import type { AppointmentConstraint } from "@/lib/types";

export function safeDate(value: string): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function constraintLabel(constraint: AppointmentConstraint): string {
  switch (constraint.type) {
    case "fixed":
      return `Fixed ${formatDisplayTime(constraint.time)}`;
    case "after":
      return `After ${formatDisplayTime(constraint.time)}`;
    case "before":
      return `Before ${formatDisplayTime(constraint.time)}`;
    case "between":
      return `${formatDisplayTime(constraint.start)}–${formatDisplayTime(constraint.end)}`;
    default:
      return "Flexible";
  }
}

export function priorityLabel(priority?: string): string | null {
  if (!priority || priority === "normal") return null;
  if (priority === "high") return "High";
  if (priority === "urgent") return "Urgent";
  if (priority === "low") return "Low";
  return null;
}
