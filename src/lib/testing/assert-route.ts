import { timeToMinutes } from "@/lib/routing/round-time";
import type { Job, OptimiseResult, RouteStop } from "@/lib/types";

export function isRounded(hhmm: string, interval: 15 | 30): boolean {
  return timeToMinutes(hhmm) % interval === 0;
}

export function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} is not a finite number: ${value}`);
  }
}

export function assertHealthyResult(result: OptimiseResult): void {
  assertFiniteNumber(result.totalTravelMinutes, "totalTravelMinutes");
  assertFiniteNumber(result.totalAccessMinutes, "totalAccessMinutes");
  assertFiniteNumber(result.returnTravelMinutes, "returnTravelMinutes");
  for (const stop of result.stops) {
    assertHealthyStop(stop);
  }
}

export function assertHealthyStop(stop: RouteStop): void {
  assertFiniteNumber(stop.order, `stop ${stop.id} order`);
  if (stop.travelMinutesFromPrevious !== undefined) {
    assertFiniteNumber(
      stop.travelMinutesFromPrevious,
      `stop ${stop.id} travelMinutesFromPrevious`
    );
  }
  if (stop.suggestedArrival) {
    assertFiniteNumber(
      timeToMinutes(stop.suggestedArrival),
      `stop ${stop.id} suggestedArrival`
    );
  }
  if (stop.suggestedDeparture) {
    assertFiniteNumber(
      timeToMinutes(stop.suggestedDeparture),
      `stop ${stop.id} suggestedDeparture`
    );
  }
}

export function jobsById(jobs: Job[]): Record<string, Job> {
  return Object.fromEntries(jobs.map((job) => [job.id, job]));
}
