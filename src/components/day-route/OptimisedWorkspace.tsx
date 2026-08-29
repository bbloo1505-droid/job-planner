"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { format } from "date-fns";
import { RotateCcw, SlidersHorizontal, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DayTimeline } from "@/components/day-route/DayTimeline";
import { NearbyJobsPanel } from "@/components/day-route/NearbyJobsPanel";
import { RouteStatusBar } from "@/components/day-route/RouteStatusBar";
import { SlotSuggestionsPanel } from "@/components/day-route/SlotSuggestionsPanel";
import { StopEditor } from "@/components/day-route/StopEditor";
import { RouteMapView } from "@/components/map/RouteMapView";
import { Button } from "@/components/ui/button";
import { safeDate } from "@/lib/format";
import {
  formatDuration,
  minutesBeforeWorkingDayEnd,
  plannedReturnTime,
  totalDrivingMinutes,
} from "@/lib/route-summary";
import { formatDisplayTime } from "@/lib/routing/round-time";
import { useDayRouteStore } from "@/lib/store/day-route-store";

export function OptimisedWorkspace() {
  const settings = useDayRouteStore((state) => state.plan.settings);
  const stops = useDayRouteStore((state) => state.plan.stops);
  const jobs = useDayRouteStore((state) => state.jobs);
  const selectedKind = useDayRouteStore((state) => state.selectedKind);
  const manualOrderLock = useDayRouteStore((state) => state.manualOrderLock);
  const addStop = useDayRouteStore((state) => state.addStop);
  const reorderStop = useDayRouteStore((state) => state.reorderStop);
  const backToPlanning = useDayRouteStore((state) => state.backToPlanning);
  const runOptimise = useDayRouteStore((state) => state.runOptimise);
  const undo = useDayRouteStore((state) => state.undo);
  const undoStack = useDayRouteStore((state) => state.undoStack);

  const [confirmReoptimise, setConfirmReoptimise] = useState(false);

  useEffect(() => {
    if (!confirmReoptimise) return;
    const timer = setTimeout(() => setConfirmReoptimise(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmReoptimise]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith("unbooked:")) {
      const jobId = activeId.replace("unbooked:", "");
      if (overId === "timeline-drop") {
        addStop(jobId);
        return;
      }
      const overIndex = stops.findIndex((stop) => stop.id === overId);
      addStop(jobId, overIndex === -1 ? stops.length : overIndex);
      return;
    }

    if (activeId === overId) return;
    const fromIndex = stops.findIndex((stop) => stop.id === activeId);
    const toIndex = stops.findIndex((stop) => stop.id === overId);
    if (fromIndex >= 0 && toIndex >= 0) {
      reorderStop(fromIndex, toIndex);
    }
  }

  function onReoptimise() {
    if (manualOrderLock && !confirmReoptimise) {
      setConfirmReoptimise(true);
      return;
    }
    setConfirmReoptimise(false);
    runOptimise();
  }

  const date = safeDate(settings.date);
  const finishTime = plannedReturnTime(settings, stops, jobs);
  const driving = totalDrivingMinutes(settings, stops, jobs);
  const remaining = minutesBeforeWorkingDayEnd(settings, stops, jobs);

  const routeJobs = stops
    .map((stop) => jobs[stop.jobId])
    .filter((job) => Boolean(job));
  const confirmed = routeJobs.filter(
    (job) => job.bookingStatus === "confirmed"
  ).length;
  const tentative = routeJobs.filter(
    (job) => job.bookingStatus === "tentatively_booked"
  ).length;
  const toContact = routeJobs.filter((job) =>
    ["uncontacted", "contact_attempted"].includes(job.bookingStatus)
  ).length;
  const conflicts = stops.filter((stop) => stop.conflict).length;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <div className="flex h-full flex-col bg-canvas">
        <header className="shrink-0 border-b border-hairline bg-white px-7 pt-3.5 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="eyebrow">Day route</p>
              <h1 className="mt-1 text-[21px] leading-none font-semibold tracking-tight text-slate-900">
                {date ? format(date, "EEEE d MMMM") : "Day route"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={undoStack.length === 0}
                onClick={undo}
                title="Undo last change (Ctrl+Z)"
              >
                <Undo2 />
                Undo
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={backToPlanning}>
                <SlidersHorizontal />
                Edit properties
              </Button>
              <Button
                type="button"
                variant={confirmReoptimise ? "default" : "outline"}
                size="sm"
                onClick={onReoptimise}
                title={
                  manualOrderLock
                    ? "This route has manual changes — re-optimising may change the order"
                    : "Recalculate the most efficient order"
                }
                className={
                  confirmReoptimise
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : undefined
                }
              >
                <RotateCcw />
                {confirmReoptimise ? "Re-order anyway?" : "Re-optimise"}
              </Button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-slate-600">
            <Metric>
              {stops.length} {stops.length === 1 ? "stop" : "stops"}
            </Metric>
            <Dot />
            <Metric>
              {formatDisplayTime(settings.startTime)}
              {finishTime ? ` – ${formatDisplayTime(finishTime)}` : ""}
            </Metric>
            <Dot />
            <Metric>{formatDuration(driving)} driving</Metric>
            {confirmed > 0 ? (
              <>
                <Dot />
                <Metric className="font-medium text-prensa-green-ink">
                  {confirmed} confirmed
                </Metric>
              </>
            ) : null}
            {tentative > 0 ? (
              <>
                <Dot />
                <Metric className="text-brand-strong">{tentative} tentative</Metric>
              </>
            ) : null}
            {toContact > 0 ? (
              <>
                <Dot />
                <Metric>{toContact} still to contact</Metric>
              </>
            ) : null}
            {conflicts > 0 ? (
              <>
                <Dot />
                <Metric className="font-medium text-amber-700">
                  {conflicts} {conflicts === 1 ? "conflict" : "conflicts"}
                </Metric>
              </>
            ) : null}
            {remaining !== null && remaining < 0 ? (
              <>
                <Dot />
                <Metric className="font-medium text-amber-700">
                  exceeds working day by {formatDuration(-remaining)}
                </Metric>
              </>
            ) : null}
            <Dot />
            <span className="text-slate-400">Estimates only, not live road times</span>
          </div>
        </header>

        <RouteStatusBar />

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-7 py-4 lg:flex-row lg:overflow-hidden">
          <div className="min-w-0 space-y-4 lg:flex-1 lg:overflow-y-auto lg:pb-1">
            <DayTimeline />
            <RouteMapView />
          </div>

          <aside className="w-full shrink-0 space-y-3 lg:w-[326px] lg:overflow-y-auto lg:pb-1 xl:w-[348px]">
            {selectedKind === "stop" ? <StopEditor /> : null}
            {selectedKind === "unbooked" ? (
              <SlotSuggestionsPanel />
            ) : (
              <NearbyJobsPanel />
            )}
          </aside>
        </div>
      </div>
    </DndContext>
  );
}

function Metric({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={className ? `tabular-nums ${className}` : "tabular-nums"}>{children}</span>;
}

function Dot() {
  return <span className="text-slate-300">·</span>;
}
