import {
  minutesBeforeWorkingDayEnd,
  plannedReturnTime,
  totalDrivingMinutes,
} from "@/lib/route-summary";
import type { DayRouteState } from "@/lib/store/day-route-store";

export interface DayRouteDiagnostics {
  scenarioId: string | null;
  jobCount: number;
  scheduledCount: number;
  unbookedCount: number;
  totalTravelMinutes: number;
  plannedStart: string;
  plannedFinish: string | null;
  workingDayEnd: string | null;
  minutesBeforeWorkingDayEnd: number | null;
  constraintConflicts: Array<{
    jobId: string;
    suburb?: string;
    code: string;
    message: string;
  }>;
  confirmedCount: number;
}

export function diagnoseDayRoute(
  state: Pick<
    DayRouteState,
    "jobs" | "plan" | "activeScenarioId"
  >
): DayRouteDiagnostics {
  const { jobs, plan } = state;
  const routeJobs = plan.stops
    .map((stop) => jobs[stop.jobId])
    .filter((job): job is NonNullable<typeof job> => Boolean(job));

  return {
    scenarioId: state.activeScenarioId,
    jobCount: Object.keys(jobs).length,
    scheduledCount: plan.stops.length,
    unbookedCount: plan.unbookedPool.length,
    totalTravelMinutes: totalDrivingMinutes(plan.settings, plan.stops, jobs),
    plannedStart: plan.settings.startTime,
    plannedFinish: plannedReturnTime(plan.settings, plan.stops, jobs),
    workingDayEnd: plan.settings.workingHoursEnd ?? null,
    minutesBeforeWorkingDayEnd: minutesBeforeWorkingDayEnd(
      plan.settings,
      plan.stops,
      jobs
    ),
    constraintConflicts: plan.stops
      .filter((stop) => stop.conflict)
      .map((stop) => ({
        jobId: stop.jobId,
        suburb: jobs[stop.jobId]?.suburb,
        code: stop.conflict!.code,
        message: stop.conflict!.message,
      })),
    confirmedCount: routeJobs.filter((job) => job.bookingStatus === "confirmed")
      .length,
  };
}

export function logDayRouteDiagnostics(
  state: Pick<DayRouteState, "jobs" | "plan" | "activeScenarioId">,
  reason = "snapshot"
): DayRouteDiagnostics {
  const diagnostics = diagnoseDayRoute(state);
  console.info(`[DayRoute diagnostics · ${reason}]`, diagnostics);
  return diagnostics;
}
