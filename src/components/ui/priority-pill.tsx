import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/types";

export function PriorityPill({
  priority,
  compact = false,
}: {
  priority?: Priority | string;
  compact?: boolean;
}) {
  if (!priority || priority === "normal") return null;
  const tone =
    priority === "urgent"
      ? "bg-rose-100 text-rose-800"
      : priority === "high"
        ? "bg-rose-50 text-rose-700"
        : "bg-slate-100 text-slate-600";
  const label =
    priority === "urgent"
      ? compact
        ? "Urgent"
        : "Urgent priority"
      : priority === "high"
        ? compact
          ? "High"
          : "High priority"
        : "Low";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full font-semibold tracking-[0.04em] uppercase",
        compact ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[9.5px]",
        tone
      )}
    >
      {label}
    </span>
  );
}

export function durationLabel(minutes?: number): string | null {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes < 60) return `~${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (Number.isInteger(hours)) {
    return `~${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  const rounded = Math.round(hours * 10) / 10;
  return `~${rounded} hours`;
}
