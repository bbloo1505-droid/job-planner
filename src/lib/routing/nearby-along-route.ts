import { optimiseDay } from "@/lib/routing/optimise-day";
import type {
  DayPlanSettings,
  Job,
  NearbyMatch,
  RouteStop,
} from "@/lib/types";

export function getNearbyAlongRoute(input: {
  unbooked: Job[];
  routeJobs: Job[];
  settings: DayPlanSettings;
  existingStops: RouteStop[];
}): NearbyMatch[] {
  const { unbooked, routeJobs, settings, existingStops } = input;

  const routedIds = new Set(routeJobs.map((job) => job.id));
  const current = optimiseDay({
    jobs: routeJobs,
    settings,
    existingStops,
    preserveOrder: true,
  });

  return unbooked
    .filter((job) => !routedIds.has(job.id) && Boolean(job.address.trim()))
    .map((job) => {
      let bestInsertionIndex = routeJobs.length;
      let bestDetour = Number.POSITIVE_INFINITY;

      for (let i = 0; i <= routeJobs.length; i += 1) {
        const simulatedJobs = [...routeJobs];
        simulatedJobs.splice(i, 0, job);
        const result = optimiseDay({
          jobs: simulatedJobs,
          settings,
          existingStops: [
            ...existingStops,
            { id: `preview-${job.id}`, jobId: job.id, order: i },
          ],
          preserveOrder: true,
        });
        const detour = result.totalTravelMinutes - current.totalTravelMinutes;
        if (detour < bestDetour) {
          bestDetour = detour;
          bestInsertionIndex = i;
        }
      }

      return {
        job,
        detourMinutes: Number.isFinite(bestDetour) ? bestDetour : 0,
        bestInsertionIndex,
      };
    })
    .sort((a, b) => a.detourMinutes - b.detourMinutes);
}
