"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Flag, Plus } from "lucide-react";
import { TimelineStop } from "@/components/day-route/TimelineStop";
import { TIMELINE_GRID } from "@/components/day-route/timeline-grid";
import { TravelSegment } from "@/components/day-route/TravelSegment";
import { formatDuration, minutesBeforeWorkingDayEnd, returnLegMinutes } from "@/lib/route-summary";
import {
  addMinutes,
  formatDisplayTime,
} from "@/lib/routing/round-time";
import { useDayRouteStore } from "@/lib/store/day-route-store";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DayTimeline() {
  const plan = useDayRouteStore((state) => state.plan);
  const jobs = useDayRouteStore((state) => state.jobs);
  const selectedJobId = useDayRouteStore((state) => state.selectedJobId);
  const selectedKind = useDayRouteStore((state) => state.selectedKind);
  const selectJob = useDayRouteStore((state) => state.selectJob);
  const addPendingAddress = useDayRouteStore((state) => state.addPendingAddress);
  const backToPlanning = useDayRouteStore((state) => state.backToPlanning);
  const { setNodeRef, isOver } = useDroppable({ id: "timeline-drop" });

  const { settings, stops } = plan;
  const lastStop = stops[stops.length - 1];
  const lastJob = lastStop ? jobs[lastStop.jobId] : undefined;
  const returnMinutes = returnLegMinutes(settings, lastJob);
  const returnTime =
    lastStop?.suggestedDeparture && returnMinutes != null
      ? addMinutes(lastStop.suggestedDeparture, returnMinutes)
      : null;

  const dayEnd = settings.workingHoursEnd;
  const spareMinutes = minutesBeforeWorkingDayEnd(settings, stops, jobs);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "panel transition-shadow duration-150",
        isOver && "ring-3 ring-brand/30"
      )}
    >
      <div className="panel-header flex items-center justify-between">
        <h2 className="panel-heading">Route</h2>
        {stops.length > 1 ? (
          <span className="text-[11px] text-slate-400">Drag to reorder</span>
        ) : null}
      </div>

      <div className="px-3 py-3">
        <div className={cn(TIMELINE_GRID, "items-center py-1")}>
          <span className="text-right text-[13px] font-medium whitespace-nowrap text-slate-500 tabular-nums">
            {formatDisplayTime(settings.startTime)}
          </span>
          <span className="relative flex justify-center self-stretch">
            <span className="absolute top-1/2 bottom-0 w-px bg-hairline" />
            <span className="relative my-auto size-2.5 rounded-full border-2 border-slate-300 bg-white" />
          </span>
          <span className="pl-1 text-[12.5px] text-slate-500">
            Leave {shortPlace(settings.startLocation)}
          </span>
        </div>

        <SortableContext
          items={stops.map((stop) => stop.id)}
          strategy={verticalListSortingStrategy}
        >
          {stops.map((stop) => {
            const job = jobs[stop.jobId] as Job | undefined;
            if (!job) return null;
            return (
              <div key={stop.id}>
                <TravelSegment minutes={stop.travelMinutesFromPrevious} />
                <TimelineStop
                  stop={stop}
                  job={job}
                  selected={selectedKind === "stop" && selectedJobId === job.id}
                  onSelect={() => selectJob(job.id, "stop")}
                />
              </div>
            );
          })}
        </SortableContext>

        {lastJob ? (
          <>
            <TravelSegment minutes={returnMinutes} />
            <div className={cn(TIMELINE_GRID, "items-center py-1")}>
              <span className="text-right text-[13px] font-medium whitespace-nowrap text-slate-500 tabular-nums">
                {returnTime ? formatDisplayTime(returnTime) : ""}
              </span>
              <span className="relative flex justify-center self-stretch">
                <span className="absolute top-0 bottom-1/2 w-px bg-hairline" />
                <span className="relative my-auto flex size-4 items-center justify-center rounded-full bg-white">
                  <Flag className="size-3 text-slate-400" strokeWidth={2} />
                </span>
              </span>
              <span className="pl-1 text-[12.5px] text-slate-500">
                Return to{" "}
                {shortPlace(settings.finishLocation ?? settings.startLocation)}
              </span>
            </div>

            {dayEnd ? (
              <div className={cn(TIMELINE_GRID, "mt-1 items-start pt-2")}>
                <span className="text-right text-[13px] font-medium whitespace-nowrap text-slate-400 tabular-nums">
                  {formatDisplayTime(dayEnd)}
                </span>
                <span className="flex justify-center pt-2">
                  <span className="h-px w-3 bg-slate-300" />
                </span>
                <span className="pl-1">
                  <span className="block text-[12.5px] text-slate-500">
                    End of working day
                  </span>
                  {spareMinutes !== null ? (
                    <span
                      className={cn(
                        "block text-[11.5px]",
                        spareMinutes < 0 ? "text-amber-700" : "text-slate-400"
                      )}
                    >
                      {spareMinutes >= 0
                        ? `Route complete ${formatDuration(spareMinutes)} early`
                        : `Route exceeds working day by ${formatDuration(-spareMinutes)}`}
                    </span>
                  ) : null}
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <p className="px-2 py-8 text-center text-[12.5px] text-slate-400">
            No stops on this route yet. Drag a nearby opportunity across to start.
          </p>
        )}
      </div>

      <div className="border-t border-hairline px-2 py-1.5">
        <button
          type="button"
          onClick={() => {
            addPendingAddress();
            backToPlanning();
          }}
          className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
        >
          <Plus className="size-3.5" />
          Add property
        </button>
      </div>
    </section>
  );
}

function shortPlace(value: string): string {
  if (value.toLowerCase().includes("milton")) return "Milton";
  return value;
}
