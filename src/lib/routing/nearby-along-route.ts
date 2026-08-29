import { jobHasResolvedLocation } from "@/lib/geo";
import { optimiseDay } from "@/lib/routing/optimise-day";
import { samplingDurationOf } from "@/lib/routing/sampling";
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
      const samplingMinutes = samplingDurationOf(job, settings);
      if (!jobHasResolvedLocation(job)) {
        return {
          job,
          detourMinutes: null,
          samplingMinutes,
          dayImpactMinutes: null,
          bestInsertionIndex: routeJobs.length,
        };
      }

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

      const detourMinutes = Number.isFinite(bestDetour) ? bestDetour : 0;
      return {
        job,
        detourMinutes,
        samplingMinutes,
        dayImpactMinutes: detourMinutes + samplingMinutes,
        bestInsertionIndex,
      };
    })
    .sort((a, b) => {
      if (a.detourMinutes == null && b.detourMinutes == null) return 0;
      if (a.detourMinutes == null) return 1;
      if (b.detourMinutes == null) return -1;
      return a.detourMinutes - b.detourMinutes;
    });
}
