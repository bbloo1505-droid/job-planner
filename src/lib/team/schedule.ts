import { addMinutes, timeToMinutes } from "@/lib/routing/round-time";
import type { Allocation, Job } from "@/lib/types";

export function allocationEndTime(
  allocation: Allocation,
  job?: Job
): string | undefined {
  if (allocation.endTime) return allocation.endTime;
  if (!allocation.startTime) return undefined;
  const minutes = job?.estimatedMinutes ?? 60;
  return addMinutes(allocation.startTime, minutes);
}

export function allocationsOverlap(
  a: Allocation,
  b: Allocation,
  jobs: Record<string, Job>
): boolean {
  if (a.consultantId !== b.consultantId) return false;
  if (a.scheduledDate !== b.scheduledDate) return false;
  if (a.id === b.id) return false;
  const aStart = a.startTime;
  const bStart = b.startTime;
  if (!aStart || !bStart) return false;
  const aEnd = allocationEndTime(a, jobs[a.jobId]) ?? aStart;
  const bEnd = allocationEndTime(b, jobs[b.jobId]) ?? bStart;
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
}

export function cellHasConflict(
  allocations: Allocation[],
  jobs: Record<string, Job>
): boolean {
  for (let i = 0; i < allocations.length; i += 1) {
    for (let j = i + 1; j < allocations.length; j += 1) {
      if (allocationsOverlap(allocations[i], allocations[j], jobs)) return true;
    }
  }
  return false;
}

export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  if (hours === 0) return "0h";
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours.toFixed(1).replace(/\.0$/, "")}h`;
}
