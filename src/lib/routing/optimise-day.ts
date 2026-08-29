import { pointOf } from "@/lib/geo";
import {
  addMinutes,
  minutesToTime,
  roundUpToInterval,
  timeToMinutes,
} from "@/lib/routing/round-time";
import { estimateTravelMinutes } from "@/lib/routing/travel";
import type {
  AppointmentConstraint,
  DayPlanSettings,
  GeoPoint,
  Job,
  OptimiseResult,
  RouteStop,
  StopConflict,
  TravelImpact,
} from "@/lib/types";

function jobPoint(job: Job): GeoPoint | null {
  return pointOf(job.latitude, job.longitude);
}

function startPoint(settings: DayPlanSettings): GeoPoint | null {
  return pointOf(settings.startLat, settings.startLng);
}

function finishPoint(settings: DayPlanSettings): GeoPoint | null {
  return pointOf(settings.finishLat, settings.finishLng);
}

function visitMinutes(job: Job, settings: DayPlanSettings): number {
  return settings.visitDurationMinutes || job.estimatedMinutes;
}

function constraintEarliest(constraint: AppointmentConstraint): number | null {
  if (constraint.type === "fixed" || constraint.type === "after") {
    return timeToMinutes(constraint.time);
  }
  if (constraint.type === "between") {
    return timeToMinutes(constraint.start);
  }
  return null;
}

function travelBetween(
  from: GeoPoint | null,
  to: GeoPoint | null,
  buffer: number
): number {
  if (!from || !to) return buffer;
  return estimateTravelMinutes(from, to, buffer);
}

function applyConstraint(
  arrivalMinutes: number,
  job: Job,
  settings: DayPlanSettings
): { appointment: number; conflict?: StopConflict } {
  const roundTo = settings.roundToMinutes;
  const constraint = job.constraint;

  if (constraint.type === "fixed") {
    const fixed = timeToMinutes(constraint.time);
    if (arrivalMinutes > fixed) {
      return {
        appointment: fixed,
        conflict: {
          jobId: job.id,
          code: "late_for_fixed",
          message: `Arrives after the fixed ${constraint.time} appointment.`,
        },
      };
    }
    return { appointment: fixed };
  }

  if (constraint.type === "after") {
    const after = timeToMinutes(constraint.time);
    const appointment = roundUpToInterval(Math.max(arrivalMinutes, after), roundTo);
    return { appointment };
  }

  if (constraint.type === "before") {
    const before = timeToMinutes(constraint.time);
    const appointment = roundUpToInterval(arrivalMinutes, roundTo);
    if (appointment >= before) {
      return {
        appointment,
        conflict: {
          jobId: job.id,
          code: "missed_before",
          message: `Cannot start before ${constraint.time}.`,
        },
      };
    }
    return { appointment };
  }

  if (constraint.type === "between") {
    const start = timeToMinutes(constraint.start);
    const end = timeToMinutes(constraint.end);
    const appointment = roundUpToInterval(Math.max(arrivalMinutes, start), roundTo);
    if (appointment > end) {
      return {
        appointment,
        conflict: {
          jobId: job.id,
          code: "outside_window",
          message: `Does not fit between ${constraint.start} and ${constraint.end}.`,
        },
      };
    }
    return { appointment };
  }

  return { appointment: roundUpToInterval(arrivalMinutes, roundTo) };
}

export function orderJobs(
  jobs: Job[],
  settings: DayPlanSettings
): Job[] {
  if (jobs.length <= 1) return [...jobs];

  const remaining = [...jobs];
  const ordered: Job[] = [];
  let current = startPoint(settings);
  let now = timeToMinutes(settings.startTime);

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < remaining.length; i += 1) {
      const job = remaining[i];
      const dest = jobPoint(job);
      const travel = travelBetween(current, dest, settings.travelBufferMinutes);
      const arrival = now + travel;
      const earliest = constraintEarliest(job.constraint);
      const feasibleStart =
        job.constraint.type === "fixed"
          ? timeToMinutes(job.constraint.time)
          : roundUpToInterval(
              Math.max(arrival, earliest ?? arrival),
              settings.roundToMinutes
            );
      const wait = Math.max(0, feasibleStart - arrival);

      let latePenalty = 0;
      for (const other of remaining) {
        if (other.id === job.id || other.constraint.type !== "fixed") continue;
        const fixedTime = timeToMinutes(other.constraint.time);
        const afterThis = feasibleStart + visitMinutes(job, settings);
        const toFixed = travelBetween(dest, jobPoint(other), settings.travelBufferMinutes);
        const arriveFixed = afterThis + toFixed;
        if (arriveFixed > fixedTime) {
          latePenalty += 8000 + (arriveFixed - fixedTime);
        }
      }

      const workingEnd = settings.workingHoursEnd
        ? timeToMinutes(settings.workingHoursEnd)
        : null;
      const overflowPenalty =
        workingEnd && feasibleStart > workingEnd ? 5000 : 0;

      const score = travel + wait * 0.6 + latePenalty + overflowPenalty;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    const next = remaining.splice(bestIndex, 1)[0];
    const dest = jobPoint(next);
    const travel = travelBetween(current, dest, settings.travelBufferMinutes);
    const arrival = now + travel;
    const { appointment } = applyConstraint(arrival, next, settings);
    now = appointment + visitMinutes(next, settings);
    current = dest;
    ordered.push(next);
  }

  return ordered;
}

export function assignTimes(
  jobsInOrder: Job[],
  settings: DayPlanSettings,
  existingStops: RouteStop[] = []
): OptimiseResult {
  const stopIdByJob = new Map(existingStops.map((stop) => [stop.jobId, stop]));
  const conflicts: StopConflict[] = [];
  const stops: RouteStop[] = [];
  let currentTime = timeToMinutes(settings.startTime);
  let previous = startPoint(settings);
  let totalTravelMinutes = 0;
  let exceedsWorkingDay = false;
  const workingEnd = settings.workingHoursEnd
    ? timeToMinutes(settings.workingHoursEnd)
    : null;

  jobsInOrder.forEach((job, index) => {
    const dest = jobPoint(job);
    const travel = travelBetween(previous, dest, settings.travelBufferMinutes);
    const arrival = currentTime + travel;
    const result = applyConstraint(arrival, job, settings);
    const duration = visitMinutes(job, settings);
    const departure = result.appointment + duration;

    if (workingEnd !== null && result.appointment > workingEnd) {
      const conflict: StopConflict = {
        jobId: job.id,
        code: "exceeds_working_day",
        message: "Unable to fit this appointment into the current working day.",
      };
      result.conflict = result.conflict ?? conflict;
      exceedsWorkingDay = true;
    }

    if (result.conflict) conflicts.push(result.conflict);

    const existing = stopIdByJob.get(job.id);
    stops.push({
      id: existing?.id ?? `stop-${job.id}`,
      jobId: job.id,
      order: index,
      suggestedArrival: minutesToTime(result.appointment),
      suggestedDeparture: minutesToTime(departure),
      travelMinutesFromPrevious: travel,
      isManuallyOrdered: existing?.isManuallyOrdered ?? false,
      conflict: result.conflict,
    });

    totalTravelMinutes += travel;
    currentTime = departure;
    previous = dest ?? previous;
  });

  const finish = finishPoint(settings);
  const returnTravelMinutes =
    jobsInOrder.length > 0
      ? travelBetween(previous, finish, settings.travelBufferMinutes)
      : 0;
  totalTravelMinutes += returnTravelMinutes;

  return {
    stops,
    conflicts,
    totalTravelMinutes,
    returnTravelMinutes,
    exceedsWorkingDay,
  };
}

export function optimiseDay(input: {
  jobs: Job[];
  settings: DayPlanSettings;
  existingStops?: RouteStop[];
  preserveOrder?: boolean;
}): OptimiseResult {
  const { jobs, settings, existingStops = [], preserveOrder = false } = input;
  const ordered = preserveOrder
    ? jobs
    : orderJobs(jobs, settings);
  const result = assignTimes(ordered, settings, existingStops);
  if (!preserveOrder) {
    result.stops = result.stops.map((stop) => ({
      ...stop,
      isManuallyOrdered: false,
    }));
  }
  return result;
}

export function describeTravelImpact(impact: TravelImpact): string {
  if (impact.exceedsWorkingDay) {
    return "Unable to fit this appointment into the current working day.";
  }
  if (impact.deltaMinutes > 0) {
    return `Route updated — +${impact.deltaMinutes} min driving`;
  }
  if (impact.deltaMinutes < 0) {
    return `Route improved — ${Math.abs(impact.deltaMinutes)} min less driving`;
  }
  return "Route updated — travel time unchanged";
}

export function travelImpact(
  previousMinutes: number,
  result: OptimiseResult
): TravelImpact {
  return {
    previousMinutes,
    nextMinutes: result.totalTravelMinutes,
    deltaMinutes: result.totalTravelMinutes - previousMinutes,
    exceedsWorkingDay: result.exceedsWorkingDay,
    infeasible: result.exceedsWorkingDay || result.conflicts.length > 0,
  };
}

export function addMinutesToClock(start: string, minutes: number): string {
  return addMinutes(start, minutes);
}
