import { pointOf } from "@/lib/geo";
import { addMinutes, timeToMinutes } from "@/lib/routing/round-time";
import { estimateTravelMinutes } from "@/lib/routing/travel";
import type { DayPlanSettings, Job, RouteStop } from "@/lib/types";

export function returnLegMinutes(
  settings: DayPlanSettings,
  lastJob: Job | undefined
): number {
  const from = lastJob ? pointOf(lastJob.latitude, lastJob.longitude) : null;
  const to = pointOf(settings.finishLat, settings.finishLng);
  if (!from || !to) return 0;
  return estimateTravelMinutes(from, to, settings.travelBufferMinutes);
}

export function totalDrivingMinutes(
  settings: DayPlanSettings,
  stops: RouteStop[],
  jobs: Record<string, Job>
): number {
  const legs = stops.reduce(
    (sum, stop) => sum + (stop.travelMinutesFromPrevious ?? 0),
    0
  );
  const lastStop = stops[stops.length - 1];
  const lastJob = lastStop ? jobs[lastStop.jobId] : undefined;
  return legs + returnLegMinutes(settings, lastJob);
}

export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** Clock time the consultant is back at the finish location, or null if none. */
export function plannedReturnTime(
  settings: DayPlanSettings,
  stops: RouteStop[],
  jobs: Record<string, Job>
): string | null {
  const lastStop = stops[stops.length - 1];
  const lastJob = lastStop ? jobs[lastStop.jobId] : undefined;
  if (!lastStop?.suggestedDeparture || !lastJob) return null;
  return addMinutes(
    lastStop.suggestedDeparture,
    returnLegMinutes(settings, lastJob)
  );
}

/**
 * Minutes remaining before workingHoursEnd after returning to base.
 * Negative means the route exceeds the configured day end.
 */
export function minutesBeforeWorkingDayEnd(
  settings: DayPlanSettings,
  stops: RouteStop[],
  jobs: Record<string, Job>
): number | null {
  if (!settings.workingHoursEnd) return null;
  const finish = plannedReturnTime(settings, stops, jobs);
  if (!finish) return null;
  return timeToMinutes(settings.workingHoursEnd) - timeToMinutes(finish);
}
