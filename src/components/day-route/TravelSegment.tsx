import { Car } from "lucide-react";
import { TIMELINE_GRID } from "@/components/day-route/timeline-grid";
import { formatDistanceMeters } from "@/lib/route-summary";
import { cn } from "@/lib/utils";

export function TravelSegment({
  minutes,
  meters,
  accessMinutes,
}: {
  minutes: number | null | undefined;
  meters?: number | null;
  accessMinutes?: number | null;
}) {
  const unavailable = minutes == null;
  const distance = formatDistanceMeters(meters);
  const access = accessMinutes && accessMinutes > 0 ? accessMinutes : 0;
  return (
    <div className={cn(TIMELINE_GRID, "items-center")} aria-hidden={false}>
      <span />
      <span className="relative flex h-6 justify-center">
        <span className="w-px bg-hairline" />
      </span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-1 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Car className="size-3 shrink-0" strokeWidth={1.75} />
          <span className={unavailable ? undefined : "tabular-nums"}>
            {unavailable
              ? "Travel unavailable"
              : distance
                ? `${minutes} min estimated road travel · ${distance}`
                : `${minutes} min estimated road travel`}
          </span>
        </span>
        {!unavailable && access > 0 ? (
          <span className="tabular-nums">+{access} min access allowance</span>
        ) : null}
      </span>
    </div>
  );
}
