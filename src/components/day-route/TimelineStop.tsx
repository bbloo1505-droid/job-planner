"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, GripVertical, Lock } from "lucide-react";
import { BookingStatusText } from "@/components/day-route/BookingStatusBadge";
import { TIMELINE_GRID } from "@/components/day-route/timeline-grid";
import { constraintLabel } from "@/lib/format";
import { formatDisplayTime } from "@/lib/routing/round-time";
import { useDayRouteStore } from "@/lib/store/day-route-store";
import type { Job, RouteStop } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TimelineStop({
  stop,
  job,
  selected,
  onSelect,
}: {
  stop: RouteStop;
  job: Job;
  selected: boolean;
  onSelect: () => void;
}) {
  const duration = useDayRouteStore(
    (state) => state.plan.settings.visitDurationMinutes
  );
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stop.id });

  const isAnchored = job.constraint.type !== "flexible";
  const blocking = stop.conflict?.code === "exceeds_working_day";
  const conflict = Boolean(stop.conflict);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
      role="button"
      aria-pressed={selected}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        TIMELINE_GRID,
        "group relative cursor-pointer items-stretch rounded-md py-2 pr-1 outline-none transition-[background-color,box-shadow] duration-150",
        selected ? "bg-brand/[0.06]" : "hover:bg-slate-50",
        "focus-visible:ring-3 focus-visible:ring-brand/25",
        isDragging &&
          "z-10 bg-white opacity-95 shadow-[0_6px_16px_-6px_rgba(15,23,42,0.35)] ring-1 ring-brand/40"
      )}
    >
      {selected ? (
        <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-brand" />
      ) : null}

      <div className="pt-[3px] text-right">
        <span
          className={cn(
            "text-[17px] leading-6 font-semibold tracking-tight whitespace-nowrap tabular-nums",
            blocking
              ? "text-rose-700"
              : conflict
                ? "text-amber-700"
                : "text-slate-900"
          )}
        >
          {stop.suggestedArrival ? formatDisplayTime(stop.suggestedArrival) : "—"}
        </span>
      </div>

      <div className="relative flex justify-center">
        <span className="absolute inset-y-0 w-px bg-hairline" />
        <span
          className={cn(
            "relative mt-[7px] size-2.5 shrink-0 rounded-full ring-4 ring-white transition-colors",
            blocking
              ? "bg-rose-500"
              : conflict
                ? "bg-amber-500"
                : job.bookingStatus === "confirmed"
                  ? "bg-prensa-green"
                  : selected
                    ? "bg-brand"
                    : "bg-slate-300 group-hover:bg-slate-400"
          )}
        />
      </div>

      <div className="relative min-w-0 max-w-[760px] pl-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-[14px] leading-6 font-semibold text-slate-900">
            {job.suburb || "Unknown suburb"}
          </p>
          <span className="shrink-0 pr-5 text-[11px] text-slate-400 tabular-nums">
            {duration} min
          </span>
        </div>
        <p className="truncate text-[12.5px] leading-5 text-slate-500">
          {job.address}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px]",
              isAnchored ? "font-medium text-slate-700" : "text-slate-400"
            )}
          >
            {isAnchored ? <Lock className="size-3 shrink-0" strokeWidth={2} /> : null}
            {constraintLabel(job.constraint)}
          </span>
          <BookingStatusText status={job.bookingStatus} />
        </div>

        {stop.conflict ? (
          <p
            className={cn(
              "mt-1.5 flex items-start gap-1.5 rounded px-1.5 py-1 text-[11.5px]",
              blocking
                ? "bg-rose-50 text-rose-700"
                : "bg-amber-50 text-amber-800"
            )}
          >
            <AlertTriangle className="mt-px size-3 shrink-0" strokeWidth={2} />
            {stop.conflict.message}
          </p>
        ) : null}

        <button
          type="button"
          aria-label={`Reorder ${job.suburb || "stop"}`}
          title="Drag to reorder"
          {...attributes}
          {...listeners}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          className="absolute top-0 right-0 cursor-grab touch-none rounded p-0.5 text-slate-300 transition-colors hover:text-slate-600 focus-visible:text-slate-600 focus-visible:ring-3 focus-visible:ring-brand/25 focus-visible:outline-none active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      </div>
    </div>
  );
}
