import { geocodeAddress, pointOf } from "@/lib/geo";
import { optimiseDay } from "@/lib/routing/optimise-day";
import { formatDisplayTime } from "@/lib/routing/round-time";
import type {
  Allocation,
  Consultant,
  DayPlanSettings,
  Job,
  OptimiseResult,
} from "@/lib/types";

const SKIP_CATEGORIES = new Set(["not_available", "meeting", "laboratory"]);
const DEFAULT_OFFICE = "Prensa Milton (demo)";
const DAY_START = "07:30";
const DAY_END = "16:00";
const TRAVEL_BUFFER = 10;

export interface InsertionCostResult {
  consultantId: string;
  date: string;
  insertionIndex: number;
  existingTravelMinutes: number;
  newTravelMinutes: number;
  additionalTravelMinutes: number;
  previousJobId?: string;
  nextJobId?: string;
  previousLocation?: string;
  nextLocation?: string;
  existingLocations: string[];
  feasible: boolean;
  infeasibleReason?: string;
}

export function isFieldJob(job: Job): boolean {
  return !SKIP_CATEGORIES.has(job.workCategory ?? "");
}

export function prototypeDaySettings(
  consultant: Consultant,
  date: string
): DayPlanSettings {
  const geo = geocodeAddress(consultant.baseOffice ?? DEFAULT_OFFICE);
  return {
    date,
    startLocation: geo?.address ?? DEFAULT_OFFICE,
    startLat: geo?.lat ?? -27.4705,
    startLng: geo?.lng ?? 153.0056,
    startTime: DAY_START,
    finishLocation: geo?.address ?? DEFAULT_OFFICE,
    finishLat: geo?.lat ?? -27.4705,
    finishLng: geo?.lng ?? 153.0056,
    workingHoursEnd: DAY_END,
    visitDurationMinutes: 0,
    travelBufferMinutes: TRAVEL_BUFFER,
    roundToMinutes: 15,
  };
}

export function orderedFieldJobsForDay(input: {
  consultantId: string;
  date: string;
  allocations: Allocation[];
  jobs: Record<string, Job>;
  excludeJobId?: string;
}): Job[] {
  return input.allocations
    .filter(
      (item) =>
        item.consultantId === input.consultantId &&
        item.scheduledDate === input.date &&
        item.jobId !== input.excludeJobId
    )
    .sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        (a.startTime ?? "").localeCompare(b.startTime ?? "")
    )
    .map((item) => input.jobs[item.jobId])
    .filter((job): job is Job => Boolean(job) && isFieldJob(job) && Boolean(pointOf(job.latitude, job.longitude)));
}

function dayIsUnavailable(input: {
  consultantId: string;
  date: string;
  allocations: Allocation[];
  jobs: Record<string, Job>;
}): boolean {
  return input.allocations.some((item) => {
    if (item.consultantId !== input.consultantId || item.scheduledDate !== input.date) {
      return false;
    }
    return input.jobs[item.jobId]?.workCategory === "not_available";
  });
}

function locationOf(job: Job): string {
  return job.suburb ?? job.address;
}

function infeasibleReason(result: OptimiseResult, settings: DayPlanSettings): string | undefined {
  const endLabel = settings.workingHoursEnd
    ? formatDisplayTime(settings.workingHoursEnd)
    : "working-day end";
  if (result.exceedsWorkingDay) {
    return `Would finish after ${endLabel}`;
  }
  if (result.conflicts.length > 0) {
    const codes = new Set(result.conflicts.map((item) => item.code));
    if (codes.has("exceeds_working_day")) {
      return `Would finish after ${endLabel}`;
    }
    return "Insufficient time between fixed appointments";
  }
  return undefined;
}

function simulate(
  jobsInOrder: Job[],
  settings: DayPlanSettings
): OptimiseResult {
  return optimiseDay({
    jobs: jobsInOrder,
    settings,
    preserveOrder: true,
  });
}

/**
 * Prototype insertion-cost engine.
 * Travel comes from the shared Haversine estimator (45 km/h + buffer).
 * Swap that estimator later without changing matching UI.
 */
export function calculateBestInsertion(input: {
  job: Job;
  consultant: Consultant;
  date: string;
  allocations: Allocation[];
  jobs: Record<string, Job>;
}): InsertionCostResult {
  const settings = prototypeDaySettings(input.consultant, input.date);
  const base: InsertionCostResult = {
    consultantId: input.consultant.id,
    date: input.date,
    insertionIndex: 0,
    existingTravelMinutes: 0,
    newTravelMinutes: 0,
    additionalTravelMinutes: 0,
    existingLocations: [],
    feasible: false,
  };

  if (!pointOf(input.job.latitude, input.job.longitude)) {
    return { ...base, infeasibleReason: "Location is not mapped" };
  }

  if (
    dayIsUnavailable({
      consultantId: input.consultant.id,
      date: input.date,
      allocations: input.allocations,
      jobs: input.jobs,
    })
  ) {
    return { ...base, infeasibleReason: "Consultant is marked not available" };
  }

  const existing = orderedFieldJobsForDay({
    consultantId: input.consultant.id,
    date: input.date,
    allocations: input.allocations,
    jobs: input.jobs,
    excludeJobId: input.job.id,
  });
  const existingLocations = existing.map(locationOf);
  const current = simulate(existing, settings);
  const existingTravelMinutes = current.totalTravelMinutes;

  let best: InsertionCostResult | null = null;

  for (let insertionIndex = 0; insertionIndex <= existing.length; insertionIndex += 1) {
    const nextJobs = [...existing];
    nextJobs.splice(insertionIndex, 0, input.job);
    const simulated = simulate(nextJobs, settings);
    const reason = infeasibleReason(simulated, settings);
    const previous = existing[insertionIndex - 1];
    const next = existing[insertionIndex];
    const candidate: InsertionCostResult = {
      consultantId: input.consultant.id,
      date: input.date,
      insertionIndex,
      existingTravelMinutes,
      newTravelMinutes: simulated.totalTravelMinutes,
      additionalTravelMinutes: simulated.totalTravelMinutes - existingTravelMinutes,
      previousJobId: previous?.id,
      nextJobId: next?.id,
      previousLocation: previous ? locationOf(previous) : undefined,
      nextLocation: next ? locationOf(next) : undefined,
      existingLocations,
      feasible: !reason,
      infeasibleReason: reason,
    };

    if (!best) {
      best = candidate;
      continue;
    }
    const betterFeasible = candidate.feasible && !best.feasible;
    const worseFeasible = !candidate.feasible && best.feasible;
    if (betterFeasible) {
      best = candidate;
      continue;
    }
    if (worseFeasible) continue;
    if (candidate.additionalTravelMinutes < best.additionalTravelMinutes) {
      best = candidate;
      continue;
    }
    if (
      candidate.additionalTravelMinutes === best.additionalTravelMinutes &&
      candidate.insertionIndex < best.insertionIndex
    ) {
      best = candidate;
    }
  }

  return best ?? { ...base, existingLocations, infeasibleReason: "No insertion point" };
}

export function describeInsertion(result: InsertionCostResult): string {
  if (!result.previousLocation && !result.nextLocation) {
    return "only job of the day";
  }
  if (!result.previousLocation && result.nextLocation) {
    return `before ${result.nextLocation}`;
  }
  if (result.previousLocation && !result.nextLocation) {
    return `after ${result.previousLocation}`;
  }
  return `between ${result.previousLocation} and ${result.nextLocation}`;
}

export function describeExistingWork(result: InsertionCostResult): string {
  if (result.existingLocations.length === 0) return "No field jobs";
  return result.existingLocations.join(" → ");
}

export function formatAdditionalTravel(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `+${rounded} min estimated travel`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (rest === 0) return `+${hours}h estimated travel`;
  return `+${hours}h ${rest}m estimated travel`;
}

export function formatTravelFromExisting(minutes: number, location: string): string {
  const rounded = Math.max(0, Math.round(minutes));
  const from = location && location !== "—" ? ` from ${location}` : "";
  if (rounded < 60) return `${rounded} min${from}`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (rest === 0) return `${hours}h${from}`;
  return `${hours}h ${rest}m${from}`;
}
