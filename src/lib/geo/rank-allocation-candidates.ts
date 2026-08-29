import {
  calculateBestInsertion,
  describeExistingWork,
  describeInsertion,
  isFieldJob,
} from "@/lib/geo/insertion-cost";
import { geocodeAddress, haversineDistanceKm, pointOf } from "@/lib/geo";
import { AVG_SEQ_URBAN_KMH } from "@/lib/routing/travel";
import type { Allocation, Consultant, Job } from "@/lib/types";

/**
 * Allocation matching for unassigned jobs.
 *
 * Stage 1 score = prototype minutes from the nearest existing job that
 * day (or the home office if the day is empty) to this site.
 * Further from the site ranks worse.
 *
 * Later, replace the travel estimator with approved road minutes
 * without rewriting MatchPanel / TeamMap.
 */
export interface AllocationRankingInput {
  job: Job;
  consultants: Consultant[];
  jobs: Record<string, Job>;
  allocations: Allocation[];
  /** Monday–Friday ISO dates of the week currently on the board. */
  workingDays: string[];
}

export interface AllocationCandidate {
  consultantId: string;
  consultantName: string;
  date: string;
  insertionIndex: number;
  previousJobId?: string;
  nextJobId?: string;
  /** Existing stop used for map relationship lines. */
  existingJobId?: string;
  existingLocation: string;
  existingWork: string;
  insertionLabel: string;
  additionalTravelMinutes: number;
  existingTravelMinutes: number;
  newTravelMinutes: number;
  feasible: boolean;
  infeasibleReason?: string;
  /** Distance from nearest existing job (or office) to this site. */
  distanceKm: number;
  candidateScore: number;
}

export interface AllocationRanker {
  rank(input: AllocationRankingInput): AllocationCandidate[];
}

export function allocationWindowDays(job: Job, workingDays: string[]): string[] {
  if (workingDays.length === 0) return [];
  const weekStart = workingDays[0];
  const weekEnd = workingDays[workingDays.length - 1];
  let start = job.earliestDate ?? weekStart;
  let end = job.dueDate ?? weekEnd;
  if (job.dueDate && job.dueDate < weekStart) {
    start = weekStart;
    end = weekEnd;
  }
  if (end < start) return [...workingDays];
  return workingDays.filter((day) => day >= start && day <= end);
}

function travelMinutesFromKm(km: number): number {
  if (!Number.isFinite(km)) return Number.POSITIVE_INFINITY;
  if (km < 0.05) return 0;
  return Math.max(1, Math.round((km / AVG_SEQ_URBAN_KMH) * 60));
}

function nearestExistingAnchor(
  job: Job,
  consultant: Consultant,
  date: string,
  allocations: Allocation[],
  jobs: Record<string, Job>
): { km: number; minutes: number; jobId?: string; location: string } {
  const origin = pointOf(job.latitude, job.longitude);
  if (!origin) {
    return { km: Number.POSITIVE_INFINITY, minutes: Number.POSITIVE_INFINITY, location: "—" };
  }

  let bestKm = Number.POSITIVE_INFINITY;
  let bestJobId: string | undefined;
  let bestLocation = "—";
  for (const allocation of allocations) {
    if (allocation.consultantId !== consultant.id || allocation.scheduledDate !== date) {
      continue;
    }
    if (allocation.jobId === job.id) continue;
    const existing = jobs[allocation.jobId];
    if (!existing || !isFieldJob(existing)) continue;
    const point = pointOf(existing.latitude, existing.longitude);
    if (!point) continue;
    const km = haversineDistanceKm(origin, point);
    if (km < bestKm) {
      bestKm = km;
      bestJobId = existing.id;
      bestLocation = existing.suburb ?? existing.address;
    }
  }

  if (bestJobId) {
    return { km: bestKm, minutes: travelMinutesFromKm(bestKm), jobId: bestJobId, location: bestLocation };
  }

  const office = geocodeAddress(consultant.baseOffice ?? "Prensa Milton (demo)");
  if (!office) {
    return { km: Number.POSITIVE_INFINITY, minutes: Number.POSITIVE_INFINITY, location: "office" };
  }
  const km = haversineDistanceKm(origin, office);
  return {
    km,
    minutes: travelMinutesFromKm(km),
    location: office.suburb ?? "office",
  };
}

export function rankAllocationCandidates(
  input: AllocationRankingInput
): AllocationCandidate[] {
  if (!pointOf(input.job.latitude, input.job.longitude)) return [];

  const days = allocationWindowDays(input.job, input.workingDays);
  const nameById = Object.fromEntries(
    input.consultants.map((item) => [item.id, item.name])
  );
  const candidates: AllocationCandidate[] = [];

  for (const consultant of input.consultants) {
    if (!consultant.active) continue;
    for (const date of days) {
      const insertion = calculateBestInsertion({
        job: input.job,
        consultant,
        date,
        allocations: input.allocations,
        jobs: input.jobs,
      });
      const nearest = nearestExistingAnchor(
        input.job,
        consultant,
        date,
        input.allocations,
        input.jobs
      );
      candidates.push({
        consultantId: consultant.id,
        consultantName: nameById[consultant.id] ?? consultant.name,
        date,
        insertionIndex: insertion.insertionIndex,
        previousJobId: insertion.previousJobId,
        nextJobId: insertion.nextJobId,
        existingJobId: nearest.jobId,
        existingLocation: nearest.location,
        existingWork: describeExistingWork(insertion),
        insertionLabel: describeInsertion(insertion),
        additionalTravelMinutes: insertion.additionalTravelMinutes,
        existingTravelMinutes: insertion.existingTravelMinutes,
        newTravelMinutes: insertion.newTravelMinutes,
        feasible: insertion.feasible,
        infeasibleReason: insertion.infeasibleReason,
        distanceKm: nearest.km,
        candidateScore: insertion.feasible ? nearest.minutes : Number.POSITIVE_INFINITY,
      });
    }
  }

  return candidates.sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    if (a.candidateScore !== b.candidateScore) {
      return a.candidateScore - b.candidateScore;
    }
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.consultantName.localeCompare(b.consultantName);
  });
}

export const prototypeInsertionRanker: AllocationRanker = {
  rank: rankAllocationCandidates,
};

/** @deprecated Use prototypeInsertionRanker. Kept so older imports keep working. */
export const prototypeHaversineRanker = prototypeInsertionRanker;

export function consultantFirstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

export {
  describeExistingWork,
  describeInsertion,
  formatAdditionalTravel,
  formatTravelFromExisting,
} from "@/lib/geo/insertion-cost";
