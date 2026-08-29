import { optimiseDay } from "@/lib/routing/optimise-day";
import type {
  DayPlanSettings,
  Job,
  RouteStop,
  SlotSuggestion,
} from "@/lib/types";

export function getSlotSuggestions(input: {
  job: Job;
  routeJobs: Job[];
  settings: DayPlanSettings;
  existingStops: RouteStop[];
  limit?: number;
}): SlotSuggestion[] {
  const { job, routeJobs, settings, existingStops, limit = 3 } = input;
  if (!job) return [];

  const current = optimiseDay({
    jobs: routeJobs,
    settings,
    existingStops,
    preserveOrder: true,
  });

  const suggestions: SlotSuggestion[] = [];
  const maxIndex = routeJobs.length;

  for (let insertionIndex = 0; insertionIndex <= maxIndex; insertionIndex += 1) {
    const simulatedJobs = [...routeJobs];
    simulatedJobs.splice(insertionIndex, 0, job);
    const simulatedStops = [
      ...existingStops,
      { id: `preview-${job.id}`, jobId: job.id, order: insertionIndex },
    ];

    const result = optimiseDay({
      jobs: simulatedJobs,
      settings,
      existingStops: simulatedStops,
      preserveOrder: true,
    });

    const inserted = result.stops.find((stop) => stop.jobId === job.id);
    if (!inserted?.suggestedArrival) continue;
    if (result.exceedsWorkingDay) continue;
    if (result.conflicts.length > 0) continue;

    const fitsWorkingHours = true;
    const hasConflict = false;
    suggestions.push({
      appointmentTime: inserted.suggestedArrival,
      routeImpactMinutes: result.totalTravelMinutes - current.totalTravelMinutes,
      insertionIndex,
      fitsWorkingHours,
      hasConflict,
    });
  }

  const ranked = [...suggestions].sort((a, b) => {
    if (a.fitsWorkingHours !== b.fitsWorkingHours) {
      return a.fitsWorkingHours ? -1 : 1;
    }
    if (a.hasConflict !== b.hasConflict) {
      return a.hasConflict ? 1 : -1;
    }
    if (a.routeImpactMinutes !== b.routeImpactMinutes) {
      return a.routeImpactMinutes - b.routeImpactMinutes;
    }
    return a.insertionIndex - b.insertionIndex;
  });

  const unique: SlotSuggestion[] = [];
  for (const suggestion of ranked) {
    if (unique.some((item) => item.appointmentTime === suggestion.appointmentTime)) {
      continue;
    }
    unique.push(suggestion);
    if (unique.length >= limit) break;
  }

  return unique;
}
