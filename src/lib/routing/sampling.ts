import type { DayPlanSettings, Job } from "@/lib/types";

export const SAMPLING_PRESETS = [10, 15, 20, 30, 45, 60] as const;
export const MIN_SAMPLING_MINUTES = 5;
export const MAX_SAMPLING_MINUTES = 240;
export const DEFAULT_SAMPLING_MINUTES = 20;

export function clampSamplingMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SAMPLING_MINUTES;
  return Math.min(MAX_SAMPLING_MINUTES, Math.max(MIN_SAMPLING_MINUTES, Math.round(value)));
}

/** Time spent on site. Independent of travel cost. */
export function samplingDurationOf(
  job: Pick<Job, "samplingDurationMinutes" | "estimatedMinutes">,
  settings?: Pick<DayPlanSettings, "visitDurationMinutes">
): number {
  const raw =
    job.samplingDurationMinutes ??
    job.estimatedMinutes ??
    settings?.visitDurationMinutes ??
    DEFAULT_SAMPLING_MINUTES;
  return clampSamplingMinutes(raw);
}

export function totalSamplingMinutes(
  stops: { jobId: string }[],
  jobs: Record<string, Job>,
  settings?: Pick<DayPlanSettings, "visitDurationMinutes">
): number {
  return stops.reduce((sum, stop) => {
    const job = jobs[stop.jobId];
    return job ? sum + samplingDurationOf(job, settings) : sum;
  }, 0);
}
