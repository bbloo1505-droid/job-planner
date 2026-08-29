import { Car } from "lucide-react";
import { TIMELINE_GRID } from "@/components/day-route/timeline-grid";
import { cn } from "@/lib/utils";

export function TravelSegment({ minutes }: { minutes: number | null | undefined }) {
  const unavailable = minutes == null;
  return (
    <div className={cn(TIMELINE_GRID, "items-center")} aria-hidden={false}>
      <span />
      <span className="relative flex h-6 justify-center">
        <span className="w-px bg-hairline" />
      </span>
      <span className="flex items-center gap-1.5 pl-1 text-[11px] text-slate-400">
        <Car className="size-3 shrink-0" strokeWidth={1.75} />
        <span className={unavailable ? undefined : "tabular-nums"}>
          {unavailable ? "Travel unavailable" : `${minutes} min drive`}
        </span>
      </span>
    </div>
  );
}
