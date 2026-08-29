import { resolvedPointOf } from "@/lib/geo";
import { MAX_ROUTE_COORDINATES } from "@/lib/routing/provider";
import type { DayPlanSettings, Job, RouteStop } from "@/lib/types";

export function drivingWaypoints(input: {
  settings: DayPlanSettings;
  stops: RouteStop[];
  jobs: Record<string, Job>;
}): Array<[number, number]> | null {
  const start = resolvedPointOf(input.settings.startLat, input.settings.startLng);
  const finish = resolvedPointOf(input.settings.finishLat, input.settings.finishLng);
  if (!start || !finish) return null;

  const points: Array<[number, number]> = [[start.lng, start.lat]];
  for (const stop of input.stops) {
    const job = input.jobs[stop.jobId];
    const point = job
      ? resolvedPointOf(job.latitude, job.longitude, job.suburb)
      : null;
    if (!point) return null;
    points.push([point.lng, point.lat]);
  }
  points.push([finish.lng, finish.lat]);
  if (points.length < 2 || points.length > MAX_ROUTE_COORDINATES) return null;
  return points;
}
