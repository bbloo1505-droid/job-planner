import { jobHasResolvedLocation } from "@/lib/geo";
import {
  pickAutoAcceptMatch,
  progressLabelForAddress,
} from "@/lib/geocoding/match-address";
import { AddressSearchError } from "@/lib/geocoding/client";
import { NominatimTimeoutError } from "@/lib/geocoding/rate-limit";
import { optimiseDay } from "@/lib/routing/optimise-day";
import { samplingDurationOf } from "@/lib/routing/sampling";
import type {
  DayPlanSettings,
  GeocodingResult,
  Job,
  OptimiseResult,
  RouteStop,
} from "@/lib/types";

export type AddressSearcher = (query: string) => Promise<{
  results: GeocodingResult[];
  cached: boolean;
}>;

export type ResolveItemStatus =
  | "waiting"
  | "finding"
  | "resolved"
  | "needs_confirmation"
  | "failed"
  | "skipped";

export interface ResolveProgressItem {
  jobId: string;
  label: string;
  status: ResolveItemStatus;
}

export interface PlanResolveProgress {
  phase: "resolving" | "planning" | "done";
  items: ResolveProgressItem[];
  resolvedCount: number;
  totalCount: number;
}

export interface JobResolveOutcome {
  job: Job;
  searched: boolean;
  cached: boolean;
}

export interface PlanMyDayResult {
  jobs: Job[];
  routedJobs: Job[];
  unlocatedJobs: Job[];
  optimisation: OptimiseResult | null;
  progress: PlanResolveProgress;
}

let testSearcher: AddressSearcher | null = null;

/** Test-only. Pass null to restore the default browser searcher. */
export function setPlanDaySearcherForTests(fn: AddressSearcher | null): void {
  testSearcher = fn;
}

export function getPlanDaySearcher(
  fallback: AddressSearcher
): AddressSearcher {
  return testSearcher ?? fallback;
}

export function jobsNeedingResolution(jobs: Job[]): Job[] {
  return jobs.filter(
    (job) => job.address.trim() && !jobHasResolvedLocation(job)
  );
}

export async function resolveJobsSequentially(input: {
  jobs: Job[];
  search: AddressSearcher;
  onProgress?: (progress: PlanResolveProgress) => void;
}): Promise<JobResolveOutcome[]> {
  const outcomes: JobResolveOutcome[] = input.jobs.map((job) => ({
    job,
    searched: false,
    cached: false,
  }));
  const items: ResolveProgressItem[] = input.jobs.map((job) => ({
    jobId: job.id,
    label: progressLabelForAddress(job.address, job.suburb),
    status: jobHasResolvedLocation(job) ? "skipped" : "waiting",
  }));

  const emit = (phase: PlanResolveProgress["phase"]) => {
    input.onProgress?.({
      phase,
      items: items.map((item) => ({ ...item })),
      resolvedCount: items.filter(
        (item) => item.status === "resolved" || item.status === "skipped"
      ).length,
      totalCount: items.length,
    });
  };

  emit("resolving");

  for (let index = 0; index < input.jobs.length; index += 1) {
    const current = outcomes[index].job;
    if (!current.address.trim()) continue;
    if (jobHasResolvedLocation(current)) {
      items[index] = {
        ...items[index],
        status: "skipped",
        label: progressLabelForAddress(current.address, current.suburb),
      };
      emit("resolving");
      continue;
    }

    items[index] = { ...items[index], status: "finding" };
    emit("resolving");

    try {
      const response = await input.search(current.address);
      const accepted = pickAutoAcceptMatch(current.address, response.results);
      if (accepted) {
        const job = applyGeocodeResult(current, accepted);
        outcomes[index] = {
          job,
          searched: true,
          cached: response.cached,
        };
        items[index] = {
          jobId: job.id,
          label: progressLabelForAddress(job.address, job.suburb),
          status: "resolved",
        };
      } else if (response.results.length > 0) {
        const job: Job = {
          ...current,
          geocodingStatus: "needs_confirmation",
          geocodeCandidates: response.results,
        };
        outcomes[index] = {
          job,
          searched: true,
          cached: response.cached,
        };
        items[index] = { ...items[index], status: "needs_confirmation" };
      } else {
        outcomes[index] = {
          job: markUnresolved(current, "not_found"),
          searched: true,
          cached: response.cached,
        };
        items[index] = { ...items[index], status: "failed" };
      }
    } catch (error) {
      outcomes[index] = {
        job: markUnresolved(current, "not_found"),
        searched: true,
        cached: false,
      };
      items[index] = { ...items[index], status: "failed" };
      void error;
    }

    emit("resolving");
  }

  return outcomes;
}

export function planDayFromResolvedJobs(input: {
  jobs: Job[];
  settings: DayPlanSettings;
  existingStops?: RouteStop[];
  preserveOrder?: boolean;
}): { routedJobs: Job[]; unlocatedJobs: Job[]; optimisation: OptimiseResult } {
  const withAddress = input.jobs.filter((job) => job.address.trim());
  const routedJobs = withAddress
    .filter((job) => jobHasResolvedLocation(job))
    .map((job) => {
      const duration = samplingDurationOf(job, input.settings);
      return {
        ...job,
        samplingDurationMinutes: duration,
        estimatedMinutes: duration,
      };
    });
  const unlocatedJobs = withAddress.filter(
    (job) => !jobHasResolvedLocation(job)
  );
  const optimisation = optimiseDay({
    jobs: routedJobs,
    settings: input.settings,
    existingStops: input.existingStops,
    preserveOrder: input.preserveOrder,
  });
  return { routedJobs, unlocatedJobs, optimisation };
}

export async function planMyDayPipeline(input: {
  jobs: Job[];
  settings: DayPlanSettings;
  search: AddressSearcher;
  existingStops?: RouteStop[];
  onProgress?: (progress: PlanResolveProgress) => void;
}): Promise<PlanMyDayResult> {
  const outcomes = await resolveJobsSequentially({
    jobs: input.jobs,
    search: input.search,
    onProgress: input.onProgress,
  });
  const jobs = outcomes.map((outcome) => outcome.job);
  input.onProgress?.({
    phase: "planning",
    items: jobs.map((job) => ({
      jobId: job.id,
      label: progressLabelForAddress(job.address, job.suburb),
      status: jobHasResolvedLocation(job)
        ? "resolved"
        : job.geocodingStatus === "needs_confirmation"
          ? "needs_confirmation"
          : job.address.trim()
            ? "failed"
            : "waiting",
    })),
    resolvedCount: jobs.filter((job) => jobHasResolvedLocation(job)).length,
    totalCount: jobs.filter((job) => job.address.trim()).length,
  });

  const planned = planDayFromResolvedJobs({
    jobs,
    settings: input.settings,
    existingStops: input.existingStops,
    preserveOrder: false,
  });

  const progress: PlanResolveProgress = {
    phase: "done",
    items: jobs.map((job) => ({
      jobId: job.id,
      label: progressLabelForAddress(job.address, job.suburb),
      status: jobHasResolvedLocation(job)
        ? "resolved"
        : job.geocodingStatus === "needs_confirmation"
          ? "needs_confirmation"
          : job.address.trim()
            ? "failed"
            : "waiting",
    })),
    resolvedCount: planned.routedJobs.length,
    totalCount: jobs.filter((job) => job.address.trim()).length,
  };
  input.onProgress?.(progress);

  return {
    jobs,
    routedJobs: planned.routedJobs,
    unlocatedJobs: planned.unlocatedJobs,
    optimisation:
      planned.routedJobs.length > 0 ? planned.optimisation : null,
    progress,
  };
}

export function applyGeocodeResult(job: Job, result: GeocodingResult): Job {
  return {
    ...job,
    enteredAddress: job.address.trim() || result.displayAddress,
    address: result.displayAddress,
    resolvedDisplayAddress: result.displayAddress,
    suburb: result.suburb,
    latitude: result.latitude,
    longitude: result.longitude,
    geocodingProvider: result.provider,
    geocodedAt: new Date().toISOString(),
    geocodingStatus: "confirmed",
    geocodeCandidates: undefined,
  };
}

export async function resolveOfficeLocation(
  query: string,
  search: AddressSearcher
): Promise<GeocodingResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  try {
    const { results } = await search(trimmed);
    return pickAutoAcceptMatch(trimmed, results);
  } catch {
    return null;
  }
}

export function isTimeoutLike(error: unknown): boolean {
  return (
    error instanceof NominatimTimeoutError ||
    (error instanceof AddressSearchError && error.code === "timeout")
  );
}

function markUnresolved(job: Job, status: "not_found" | "unresolved"): Job {
  return {
    ...job,
    suburb: undefined,
    latitude: undefined,
    longitude: undefined,
    resolvedDisplayAddress: undefined,
    geocodingProvider: undefined,
    geocodedAt: undefined,
    geocodingStatus: status,
    geocodeCandidates: undefined,
  };
}
