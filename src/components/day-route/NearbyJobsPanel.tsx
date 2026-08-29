"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { priorityLabel, safeDate } from "@/lib/format";
import { getNearbyAlongRoute } from "@/lib/routing/nearby-along-route";
import { useDayRouteStore } from "@/lib/store/day-route-store";
import { cn } from "@/lib/utils";

export function NearbyJobsPanel() {
  const unbooked = useDayRouteStore((state) => state.plan.unbookedPool);
  const stops = useDayRouteStore((state) => state.plan.stops);
  const jobs = useDayRouteStore((state) => state.jobs);
  const settings = useDayRouteStore((state) => state.plan.settings);
  const selectedJobId = useDayRouteStore((state) => state.selectedJobId);
  const selectedKind = useDayRouteStore((state) => state.selectedKind);
  const selectJob = useDayRouteStore((state) => state.selectJob);
  const addStop = useDayRouteStore((state) => state.addStop);

  const routeJobs = stops.map((stop) => jobs[stop.jobId]).filter(Boolean);
  const matches = useMemo(
    () =>
      getNearbyAlongRoute({
        unbooked,
        routeJobs,
        settings,
        existingStops: stops,
      }),
    [unbooked, routeJobs, settings, stops]
  );

  return (
    <section className="panel">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <h2 className="panel-heading">Nearby opportunities</h2>
        <span className="text-[11px] text-slate-400 tabular-nums">
          {matches.length}
        </span>
      </div>

      {matches.length === 0 ? (
        <p className="px-4 py-8 text-center text-[12.5px] text-slate-400">
          Every unbooked property is already on the route.
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {matches.map((match, index) => (
            <NearbyRow
              key={match.job.id}
              jobId={match.job.id}
              suburb={match.job.suburb ?? "Unknown"}
              address={match.job.address}
              detour={match.detourMinutes}
              priority={priorityLabel(match.job.priority)}
              dueDate={match.job.dueDate}
              best={index === 0}
              selected={
                selectedKind === "unbooked" && selectedJobId === match.job.id
              }
              onSelect={() => selectJob(match.job.id, "unbooked")}
              onAdd={() => addStop(match.job.id, match.bestInsertionIndex)}
            />
          ))}
        </ul>
      )}

      <p className="border-t border-hairline px-4 py-2 text-[11px] text-slate-400">
        Detour estimates. Select a property for the best times to offer.
      </p>
    </section>
  );
}

function NearbyRow({
  jobId,
  suburb,
  address,
  detour,
  priority,
  dueDate,
  best,
  selected,
  onSelect,
  onAdd,
}: {
  jobId: string;
  suburb: string;
  address: string;
  detour: number;
  priority: string | null;
  dueDate?: string;
  best: boolean;
  selected: boolean;
  onSelect: () => void;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable(
    { id: `unbooked:${jobId}` }
  );
  const due = dueDate ? safeDate(dueDate) : null;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "group relative flex cursor-grab gap-3 px-4 py-2.5 transition-colors duration-150 outline-none active:cursor-grabbing",
        selected ? "bg-brand/[0.06]" : "hover:bg-slate-50",
        "focus-visible:ring-3 focus-visible:ring-brand/25",
        isDragging && "opacity-60"
      )}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      {...attributes}
      {...listeners}
    >
      {selected ? (
        <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brand" />
      ) : null}

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-slate-900">
            {suburb}
          </span>
          {best ? (
            <span className="shrink-0 rounded bg-prensa-green/15 px-1 py-px text-[9px] font-semibold tracking-[0.06em] text-prensa-green-ink uppercase">
              Best fit
            </span>
          ) : null}
        </p>
        <p className="truncate text-[12px] text-slate-500">{address}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
          {due ? <span>Due {format(due, "EEE")}</span> : null}
          {due && priority ? <span className="text-slate-300">·</span> : null}
          {priority ? <span className="font-medium">{priority}</span> : null}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            "text-[15px] leading-none font-semibold tabular-nums",
            best ? "text-prensa-green-ink" : "text-slate-800"
          )}
        >
          +{Math.max(0, detour)} min
        </span>
        <span className="text-[10.5px] text-slate-400">detour</span>
        <button
          type="button"
          aria-label={`Add ${suburb} to route`}
          onClick={(event) => {
            event.stopPropagation();
            onAdd();
          }}
          className="mt-0.5 flex h-6 items-center gap-1 rounded-md border border-hairline bg-white px-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:border-brand hover:text-brand focus-visible:ring-3 focus-visible:ring-brand/25 focus-visible:outline-none"
        >
          <Plus className="size-3" />
          Add
        </button>
      </div>
    </li>
  );
}
