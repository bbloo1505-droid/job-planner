import {
  calculateBestInsertion,
  describeExistingWork,
  describeInsertion,
  isFieldJob,
} from "@/lib/geo/insertion-cost";
import { haversineDistanceKm, pointOf } from "@/lib/geo";
import type { Allocation, Consultant, Job } from "@/lib/types";

/**
 * Allocation matching for unassigned jobs.
 *
 * Stage 1 score = additional prototype travel minutes from the best
 * insertion into that consultant's existing day (Haversine estimator).
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
  /** Nearest existing job, for context only — not the ranking score. */
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

function nearestExistingKm(
  job: Job,
  consultantId: string,
  date: string,
  allocations: Allocation[],
  jobs: Record<string, Job>
): number {
  const origin = pointOf(job.latitude, job.longitude);
  if (!origin) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (const allocation of allocations) {
    if (allocation.consultantId !== consultantId || allocation.scheduledDate !== date) {
      continue;
    }
    if (allocation.jobId === job.id) continue;
    const existing = jobs[allocation.jobId];
    if (!existing || !isFieldJob(existing)) continue;
    const point = pointOf(existing.latitude, existing.longitude);
    if (!point) continue;
    best = Math.min(best, haversineDistanceKm(origin, point));
  }
  return best;
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
      const anchorId = insertion.previousJobId ?? insertion.nextJobId;
      const anchorJob = anchorId ? input.jobs[anchorId] : undefined;
      candidates.push({
        consultantId: consultant.id,
        consultantName: nameById[consultant.id] ?? consultant.name,
        date,
        insertionIndex: insertion.insertionIndex,
        previousJobId: insertion.previousJobId,
        nextJobId: insertion.nextJobId,
        existingJobId: anchorId,
        existingLocation:
          insertion.previousLocation ??
          insertion.nextLocation ??
          anchorJob?.suburb ??
          "—",
        existingWork: describeExistingWork(insertion),
        insertionLabel: describeInsertion(insertion),
        additionalTravelMinutes: insertion.additionalTravelMinutes,
        existingTravelMinutes: insertion.existingTravelMinutes,
        newTravelMinutes: insertion.newTravelMinutes,
        feasible: insertion.feasible,
        infeasibleReason: insertion.infeasibleReason,
        distanceKm: nearestExistingKm(
          input.job,
          consultant.id,
          date,
          input.allocations,
          input.jobs
        ),
        candidateScore: insertion.feasible
          ? insertion.additionalTravelMinutes
          : Number.POSITIVE_INFINITY,
      });
    }
  }

  return candidates.sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    if (a.additionalTravelMinutes !== b.additionalTravelMinutes) {
      return a.additionalTravelMinutes - b.additionalTravelMinutes;
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
} from "@/lib/geo/insertion-cost";
