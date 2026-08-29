import { resolvedPointOf } from "@/lib/geo";
import { clampAccessBuffer } from "@/lib/routing/access-buffer";
import { addMinutes, timeToMinutes } from "@/lib/routing/round-time";
import { totalSamplingMinutes } from "@/lib/routing/sampling";
import { estimateTravelMinutesOrNull } from "@/lib/routing/travel";
import type { DayPlanSettings, Job, RouteStop } from "@/lib/types";

export function returnLegMinutes(
  settings: DayPlanSettings,
  lastJob: Job | undefined,
  storedMinutes?: number
): number | null {
  if (storedMinutes != null && Number.isFinite(storedMinutes)) return storedMinutes;
  const from = lastJob
    ? resolvedPointOf(lastJob.latitude, lastJob.longitude, lastJob.suburb)
    : null;
  const to = resolvedPointOf(settings.finishLat, settings.finishLng);
  return estimateTravelMinutesOrNull(from, to, 0);
}

export function totalDrivingMinutes(
  settings: DayPlanSettings,
  stops: RouteStop[],
  jobs: Record<string, Job>,
  storedReturnMinutes?: number
): number {
  const legs = stops.reduce(
    (sum, stop) => sum + (stop.travelMinutesFromPrevious ?? 0),
    0
  );
  const lastStop = stops[stops.length - 1];
  const lastJob = lastStop ? jobs[lastStop.jobId] : undefined;
  return legs + (returnLegMinutes(settings, lastJob, storedReturnMinutes) ?? 0);
}

export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins}m`;
  if (hours > 0 && mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatDistanceMeters(meters: number | null | undefined): string | null {
  if (meters == null || !Number.isFinite(meters) || meters < 50) return null;
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

export function returnAccessMinutes(
  settings: DayPlanSettings,
  lastJob: Job | undefined,
  storedReturnMinutes?: number
): number {
  const road = returnLegMinutes(settings, lastJob, storedReturnMinutes);
  if (road == null) return 0;
  return clampAccessBuffer(settings.travelBufferMinutes);
}

export function totalAccessAllowanceMinutes(
  settings: DayPlanSettings,
  stops: RouteStop[],
  jobs: Record<string, Job>,
  storedReturnMinutes?: number
): number {
  const fromStops = stops.reduce(
    (sum, stop) => sum + (stop.accessBufferMinutes ?? 0),
    0
  );
  const lastStop = stops[stops.length - 1];
  const lastJob = lastStop ? jobs[lastStop.jobId] : undefined;
  return fromStops + returnAccessMinutes(settings, lastJob, storedReturnMinutes);
}

export function totalWaitingMinutes(stops: RouteStop[]): number {
  return stops.reduce((sum, stop) => sum + (stop.waitingMinutes ?? 0), 0);
}

export function totalPlannedDayMinutes(
  settings: DayPlanSettings,
  stops: RouteStop[],
  jobs: Record<string, Job>,
  storedReturnMinutes?: number
): number {
  return (
    totalDrivingMinutes(settings, stops, jobs, storedReturnMinutes) +
    totalSamplingMinutes(stops, jobs, settings) +
    totalAccessAllowanceMinutes(settings, stops, jobs, storedReturnMinutes) +
    totalWaitingMinutes(stops)
  );
}

/** Clock time the consultant is back at the finish location, or null if none. */
export function plannedReturnTime(
  settings: DayPlanSettings,
  stops: RouteStop[],
  jobs: Record<string, Job>,
  storedReturnMinutes?: number
): string | null {
  const lastStop = stops[stops.length - 1];
  const lastJob = lastStop ? jobs[lastStop.jobId] : undefined;
  if (!lastStop?.suggestedDeparture || !lastJob) return null;
  const returnMinutes = returnLegMinutes(settings, lastJob, storedReturnMinutes);
  if (returnMinutes == null) return null;
  const access = returnAccessMinutes(settings, lastJob, storedReturnMinutes);
  return addMinutes(lastStop.suggestedDeparture, returnMinutes + access);
}

/**
 * Minutes remaining before workingHoursEnd after returning to base.
 * Negative means the route exceeds the configured day end.
 */
export function minutesBeforeWorkingDayEnd(
  settings: DayPlanSettings,
  stops: RouteStop[],
  jobs: Record<string, Job>,
  storedReturnMinutes?: number
): number | null {
  if (!settings.workingHoursEnd) return null;
  const finish = plannedReturnTime(settings, stops, jobs, storedReturnMinutes);
  if (!finish) return null;
  return timeToMinutes(settings.workingHoursEnd) - timeToMinutes(finish);
}
