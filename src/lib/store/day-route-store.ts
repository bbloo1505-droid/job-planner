import { create } from "zustand";
import { createDemoPlan } from "@/lib/dummy-data";
import { geocodeExactAddress, jobHasResolvedLocation, pointOf } from "@/lib/geo";
import { searchAddressFromBrowser } from "@/lib/geocoding/client";
import {
  applyGeocodeResult,
  getPlanDaySearcher,
  planMyDayPipeline,
  resolveOfficeLocation,
  type PlanResolveProgress,
} from "@/lib/geocoding/plan-my-day";
import { normalizeGeocodeQuery } from "@/lib/geocoding/provider";
import { parseAddressLines } from "@/lib/parse-addresses";
import { clampAccessBuffer } from "@/lib/routing/access-buffer";
import {
  clampSamplingMinutes,
  DEFAULT_SAMPLING_MINUTES,
  samplingDurationOf,
} from "@/lib/routing/sampling";
import { getNearbyAlongRoute } from "@/lib/routing/nearby-along-route";
import {
  describeTravelImpact,
  optimiseDay,
  travelImpact,
} from "@/lib/routing/optimise-day";
import { fetchRouteFromBrowser } from "@/lib/routing/client";
import {
  routeCacheKey,
  travelLegsFromRoute,
  type RoadRoute,
} from "@/lib/routing/provider";
import { drivingWaypoints } from "@/lib/routing/waypoints";
import { getSlotSuggestions } from "@/lib/routing/slot-suggestions";
import {
  getValidationScenario,
  materialiseScenario,
} from "@/lib/testing/validation-scenarios";
import type {
  AppointmentConstraint,
  BookingStatus,
  DayPlan,
  DayPlanSettings,
  GeocodingResult,
  Job,
  NearbyMatch,
  SlotSuggestion,
  TravelImpact,
} from "@/lib/types";

const MAX_UNDO = 20;

type SelectedKind = "stop" | "unbooked" | null;

export type RoadRouteStatus = "idle" | "loading" | "live" | "fallback";

const FALLBACK_ROUTE_MESSAGE =
  "Live road routing unavailable — using estimated travel.";

interface Snapshot {
  jobs: Record<string, Job>;
  pendingJobIds: string[];
  plan: DayPlan;
  selectedJobId: string | null;
  selectedKind: SelectedKind;
  needsRecalculate: boolean;
  hasOptimised: boolean;
  manualOrderLock: boolean;
  activeScenarioId: string | null;
  unlocatedJobIds: string[];
  roadRoute: RoadRoute | null;
  roadRouteKey: string | null;
  roadRouteStatus: RoadRouteStatus;
  roadRouteMessage: string | null;
}

export interface DayRouteState extends Snapshot {
  lastImpact: TravelImpact | null;
  impactMessage: string | null;
  lastConstraintJobId: string | null;
  undoStack: Snapshot[];
  isPlanning: boolean;
  planProgress: PlanResolveProgress | null;
  initDayPlan: (date: string) => void;
  updateSettings: (partial: Partial<DayPlanSettings>) => void;
  bulkAddAddresses: (text: string) => number;
  addPendingAddress: () => string;
  updatePendingJob: (jobId: string, address: string) => void;
  confirmGeocodedAddress: (jobId: string, result: GeocodingResult) => void;
  confirmPlanLocation: (
    role: "start" | "finish",
    result: GeocodingResult
  ) => void;
  changeJobAddress: (jobId: string) => void;
  markAddressNotFound: (jobId: string) => void;
  updateSamplingDuration: (jobId: string, minutes: number) => void;
  removePendingJob: (jobId: string) => void;
  addStop: (jobId: string, insertionIndex?: number) => void;
  /** Remove a stop from today and return the job to the unbooked pool. */
  moveOutOfDay: (stopId: string) => void;
  /** @deprecated Use moveOutOfDay — kept so existing call sites keep working. */
  removeStop: (stopId: string) => void;
  runOptimise: () => void;
  planMyDay: () => Promise<void>;
  retryUnlocatedJob: (jobId: string) => Promise<void>;
  recalculate: () => void;
  reorderStop: (fromIndex: number, toIndex: number) => void;
  updateJobConstraint: (jobId: string, constraint: AppointmentConstraint) => void;
  updateBookingStatus: (jobId: string, status: BookingStatus) => void;
  updateJobNotes: (jobId: string, notes: string) => void;
  confirmSuggestedTime: (jobId: string) => void;
  applySlotSuggestion: (jobId: string, suggestion: SlotSuggestion) => void;
  selectJob: (jobId: string | null, kind?: SelectedKind) => void;
  getSlotSuggestionsFor: (jobId: string) => SlotSuggestion[];
  getNearbyUnbooked: () => NearbyMatch[];
  undo: () => void;
  backToPlanning: () => void;
  dismissImpact: () => void;
  loadScenario: (id: string) => boolean;
  refreshRoadRoute: (options?: { force?: boolean }) => Promise<void>;
  rerouteRoad: () => void;
}

function cloneSnapshot(state: Snapshot): Snapshot {
  return {
    jobs: structuredClone(state.jobs),
    pendingJobIds: [...state.pendingJobIds],
    plan: structuredClone(state.plan),
    selectedJobId: state.selectedJobId,
    selectedKind: state.selectedKind,
    needsRecalculate: state.needsRecalculate,
    hasOptimised: state.hasOptimised,
    manualOrderLock: state.manualOrderLock,
    activeScenarioId: state.activeScenarioId,
    unlocatedJobIds: [...state.unlocatedJobIds],
    roadRoute: state.roadRoute
      ? structuredClone(state.roadRoute)
      : null,
    roadRouteKey: state.roadRouteKey,
    roadRouteStatus: state.roadRouteStatus,
    roadRouteMessage: state.roadRouteMessage,
  };
}

function nextJobNumber(jobs: Record<string, Job>): string {
  let max = 0;
  for (const job of Object.values(jobs)) {
    const match = job.jobNumber?.match(/PR-TEST-(\d+)/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `PR-TEST-${String(max + 1).padStart(3, "0")}`;
}

function newJob(jobs: Record<string, Job>, address: string, duration = DEFAULT_SAMPLING_MINUTES): Job {
  const minutes = clampSamplingMinutes(duration);
  return {
    id: crypto.randomUUID(),
    address,
    enteredAddress: address,
    suburb: undefined,
    samplingDurationMinutes: minutes,
    estimatedMinutes: minutes,
    geocodingStatus: "unresolved",
    constraint: { type: "flexible" },
    bookingStatus: "uncontacted",
    priority: "normal",
    jobNumber: nextJobNumber(jobs),
    client: "Sample Client A",
  };
}

function syncJob(
  state: Snapshot,
  jobId: string,
  updated: Job
): Pick<Snapshot, "jobs" | "plan"> {
  return {
    jobs: { ...state.jobs, [jobId]: updated },
    plan: {
      ...state.plan,
      unbookedPool: state.plan.unbookedPool.map((item) =>
        item.id === jobId ? updated : item
      ),
    },
  };
}

function confirmationStillMatches(job: Job, typed: string): boolean {
  const keys = [
    job.enteredAddress,
    job.resolvedDisplayAddress,
    job.address,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map(normalizeGeocodeQuery);
  return keys.includes(normalizeGeocodeQuery(typed));
}

function routeJobsOf(state: Snapshot): Job[] {
  return state.plan.stops
    .map((stop) => state.jobs[stop.jobId])
    .filter((job): job is Job => Boolean(job));
}

function applyResult(
  state: Snapshot,
  preserveOrder: boolean
): ReturnType<typeof optimiseDay> {
  const jobs = routeJobsOf(state);
  return optimiseDay({
    jobs,
    settings: state.plan.settings,
    existingStops: state.plan.stops,
    preserveOrder,
    travelLegs: travelLegsFor(state),
  });
}

function travelLegsFor(state: Snapshot) {
  if (state.roadRouteStatus !== "live" || !state.roadRoute || !state.roadRouteKey) {
    return undefined;
  }
  const coords = drivingWaypoints({
    settings: state.plan.settings,
    stops: state.plan.stops,
    jobs: state.jobs,
  });
  if (!coords) return undefined;
  if (routeCacheKey(coords) !== state.roadRouteKey) return undefined;
  const legs = travelLegsFromRoute(state.roadRoute);
  if (legs.length !== coords.length - 1) return undefined;
  return legs;
}

function withTimedPlan(
  plan: DayPlan,
  result: ReturnType<typeof optimiseDay>
): DayPlan {
  return {
    ...plan,
    stops: result.stops,
    returnTravelMinutes: result.returnTravelMinutes,
    returnTravelMeters: result.returnTravelMeters,
  };
}

const EMPTY_ROAD = {
  roadRoute: null as RoadRoute | null,
  roadRouteKey: null as string | null,
  roadRouteStatus: "idle" as RoadRouteStatus,
  roadRouteMessage: null as string | null,
};

let roadRouteDebounceMs = 400;
let roadRouteTimer: ReturnType<typeof setTimeout> | null = null;
let roadRouteGeneration = 0;

export function setRoadRouteDebounceForTests(ms: number | null): void {
  roadRouteDebounceMs = ms ?? 400;
}

export function cancelScheduledRoadRoute(): void {
  if (roadRouteTimer) {
    clearTimeout(roadRouteTimer);
    roadRouteTimer = null;
  }
  roadRouteGeneration += 1;
}

function scheduleRoadRouteRefresh(): void {
  if (roadRouteTimer) clearTimeout(roadRouteTimer);
  roadRouteTimer = setTimeout(() => {
    roadRouteTimer = null;
    void useDayRouteStore.getState().refreshRoadRoute();
  }, roadRouteDebounceMs);
}

export async function flushRoadRouteForTests(): Promise<void> {
  if (roadRouteTimer) {
    clearTimeout(roadRouteTimer);
    roadRouteTimer = null;
  }
  await useDayRouteStore.getState().refreshRoadRoute();
}

const demo = createDemoPlan();

export const useDayRouteStore = create<DayRouteState>((set, get) => ({
  jobs: demo.jobs,
  pendingJobIds: demo.pendingJobIds,
  plan: demo.plan,
  selectedJobId: null,
  selectedKind: null,
  needsRecalculate: false,
  hasOptimised: false,
  manualOrderLock: false,
  activeScenarioId: null,
  lastImpact: null,
  impactMessage: null,
  lastConstraintJobId: null,
  undoStack: [],
  isPlanning: false,
  planProgress: null,
  unlocatedJobIds: [],
  ...EMPTY_ROAD,

  initDayPlan: (date) => {
    const fresh = createDemoPlan();
    fresh.plan.settings.date = date;
    set({
      jobs: fresh.jobs,
      pendingJobIds: fresh.pendingJobIds,
      plan: fresh.plan,
      selectedJobId: null,
      selectedKind: null,
      needsRecalculate: false,
      hasOptimised: false,
      manualOrderLock: false,
      activeScenarioId: null,
      lastImpact: null,
      impactMessage: null,
      undoStack: [],
      isPlanning: false,
      planProgress: null,
      unlocatedJobIds: [],
      ...EMPTY_ROAD,
    });
  },

  updateSettings: (partial) => {
    const next = { ...partial };
    if (next.travelBufferMinutes !== undefined) {
      next.travelBufferMinutes = clampAccessBuffer(next.travelBufferMinutes);
    }
    if (next.roundToMinutes !== undefined && next.roundToMinutes !== 15 && next.roundToMinutes !== 30) {
      next.roundToMinutes = 15;
    }
    if (partial.startLocation !== undefined) {
      const geo = geocodeExactAddress(partial.startLocation);
      next.startLat = geo?.lat;
      next.startLng = geo?.lng;
    }
    if (partial.finishLocation !== undefined) {
      const geo = geocodeExactAddress(partial.finishLocation);
      next.finishLat = geo?.lat;
      next.finishLng = geo?.lng;
    }
    const locationChanged =
      partial.startLocation !== undefined ||
      partial.finishLocation !== undefined ||
      partial.startLat !== undefined ||
      partial.startLng !== undefined ||
      partial.finishLat !== undefined ||
      partial.finishLng !== undefined;
    set((state) => {
      const plan = {
        ...state.plan,
        settings: { ...state.plan.settings, ...next },
      };
      if (!state.hasOptimised) {
        return { plan };
      }
      if (locationChanged) {
        return { plan };
      }
      const result = applyResult({ ...state, plan }, true);
      return {
        plan: withTimedPlan(plan, result),
        needsRecalculate: false,
      };
    });
    if (locationChanged && get().hasOptimised) scheduleRoadRouteRefresh();
  },

  bulkAddAddresses: (text) => {
    const lines = parseAddressLines(text);
    if (lines.length === 0) return 0;
    set((state) => {
      const snapshot = cloneSnapshot(state);
      const jobs = { ...state.jobs };
      const pendingJobIds = [...state.pendingJobIds];
      const existingAddresses = new Set(
        Object.values(jobs).map((job) => job.address.toLowerCase())
      );
      for (const line of lines) {
        if (existingAddresses.has(line.toLowerCase())) continue;
        const job = newJob(jobs, line, state.plan.settings.visitDurationMinutes);
        jobs[job.id] = job;
        pendingJobIds.push(job.id);
        existingAddresses.add(job.address.toLowerCase());
      }
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        jobs,
        pendingJobIds,
      };
    });
    return lines.length;
  },

  addPendingAddress: () => {
    const id = crypto.randomUUID();
    set((state) => {
      const snapshot = cloneSnapshot(state);
      const minutes = clampSamplingMinutes(state.plan.settings.visitDurationMinutes);
      const job: Job = {
        id,
        address: "",
        enteredAddress: "",
        suburb: "",
        samplingDurationMinutes: minutes,
        estimatedMinutes: minutes,
        geocodingStatus: "unresolved",
        constraint: { type: "flexible" },
        bookingStatus: "uncontacted",
        priority: "normal",
        jobNumber: nextJobNumber(state.jobs),
        client: "Sample Client A",
      };
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        jobs: { ...state.jobs, [id]: job },
        pendingJobIds: [...state.pendingJobIds, id],
      };
    });
    return id;
  },

  updatePendingJob: (jobId, address) => {
    set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      const stillConfirmed =
        job.geocodingStatus === "confirmed" && confirmationStillMatches(job, address);
      const updated: Job = stillConfirmed
        ? { ...job, address, enteredAddress: address }
        : {
            ...job,
            address,
            enteredAddress: address,
            suburb: undefined,
            latitude: undefined,
            longitude: undefined,
            resolvedDisplayAddress: undefined,
            geocodingProvider: undefined,
            geocodedAt: undefined,
            geocodingStatus: address.trim()
              ? job.geocodingStatus === "confirmed"
                ? "stale"
                : "unresolved"
              : "unresolved",
          };
      return syncJob(state, jobId, updated);
    });
  },

  confirmPlanLocation: (role, result) => {
    set((state) => {
      const settings =
        role === "start"
          ? {
              ...state.plan.settings,
              startLocation: result.displayAddress,
              startLat: result.latitude,
              startLng: result.longitude,
            }
          : {
              ...state.plan.settings,
              finishLocation: result.displayAddress,
              finishLat: result.latitude,
              finishLng: result.longitude,
            };
      return {
        plan: { ...state.plan, settings },
        needsRecalculate: state.hasOptimised,
      };
    });
    if (get().hasOptimised) scheduleRoadRouteRefresh();
  },

  confirmGeocodedAddress: (jobId, result) => {
    set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      const updated = applyGeocodeResult(job, result);
      const next = syncJob(state, jobId, updated);
      const unlocatedJobIds = state.unlocatedJobIds.filter((id) => id !== jobId);
      const onRoute = state.plan.stops.some((stop) => stop.jobId === jobId);
      if (!state.hasOptimised) return { ...next, unlocatedJobIds };
      const snapshot = cloneSnapshot(state);
      let plan = next.plan;
      const pendingJobIds = state.pendingJobIds.filter((id) => id !== jobId);
      if (!onRoute) {
        plan = {
          ...plan,
          stops: [
            ...plan.stops,
            {
              id: `stop-${jobId}`,
              jobId,
              order: plan.stops.length,
              isManuallyOrdered: true,
            },
          ],
          unbookedPool: plan.unbookedPool.filter((item) => item.id !== jobId),
        };
      }
      const merged: Snapshot = {
        ...cloneSnapshot(state),
        ...next,
        plan,
        pendingJobIds,
        unlocatedJobIds,
      };
      const previousTravel = applyResult(state, true).totalTravelMinutes;
      const resultTimes = applyResult(merged, true);
      return {
        ...next,
        pendingJobIds,
        unlocatedJobIds,
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        plan: withTimedPlan(plan, resultTimes),
        lastImpact: travelImpact(previousTravel, resultTimes),
        impactMessage: `${result.suburb ?? "Address"} resolved — appointment times updated.`,
        needsRecalculate: false,
        roadRouteStatus: "loading",
        roadRouteMessage: null,
      };
    });
    if (get().hasOptimised) scheduleRoadRouteRefresh();
  },

  changeJobAddress: (jobId) => {
    set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      const updated: Job = {
        ...job,
        address: job.enteredAddress ?? job.address,
        suburb: undefined,
        latitude: undefined,
        longitude: undefined,
        resolvedDisplayAddress: undefined,
        geocodingProvider: undefined,
        geocodedAt: undefined,
        geocodingStatus: "unresolved",
      };
      return syncJob(state, jobId, updated);
    });
  },

  markAddressNotFound: (jobId) => {
    set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      return syncJob(state, jobId, {
        ...job,
        suburb: undefined,
        latitude: undefined,
        longitude: undefined,
        resolvedDisplayAddress: undefined,
        geocodingProvider: undefined,
        geocodedAt: undefined,
        geocodingStatus: "not_found",
      });
    });
  },

  updateSamplingDuration: (jobId, minutes) => {
    set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      const nextMinutes = clampSamplingMinutes(minutes);
      const previous = samplingDurationOf(job, state.plan.settings);
      if (nextMinutes === previous) return state;
      const snapshot = cloneSnapshot(state);
      const updated: Job = {
        ...job,
        samplingDurationMinutes: nextMinutes,
        estimatedMinutes: nextMinutes,
      };
      const next = syncJob(state, jobId, updated);
      const onRoute = state.plan.stops.some((stop) => stop.jobId === jobId);
      if (!onRoute || !state.hasOptimised) {
        return {
          ...next,
          undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        };
      }
      const previousTravel = applyResult(state, true).totalTravelMinutes;
      const result = applyResult({ ...state, ...next }, true);
      const suburb = updated.suburb || "Stop";
      return {
        ...next,
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        plan: withTimedPlan(next.plan, result),
        lastImpact: travelImpact(previousTravel, result),
        impactMessage: `${suburb} duration changed from ${previous} to ${nextMinutes} min — appointment times updated.`,
        needsRecalculate: false,
      };
    });
  },

  removePendingJob: (jobId) => {
    set((state) => {
      const snapshot = cloneSnapshot(state);
      const jobs = { ...state.jobs };
      delete jobs[jobId];
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        jobs,
        pendingJobIds: state.pendingJobIds.filter((id) => id !== jobId),
      };
    });
  },

  addStop: (jobId, insertionIndex) => {
    set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      if (state.plan.stops.some((stop) => stop.jobId === jobId)) return state;
      const snapshot = cloneSnapshot(state);
      const index = insertionIndex ?? state.plan.stops.length;
      const newStop = {
        id: `stop-${jobId}`,
        jobId,
        order: index,
        isManuallyOrdered: true,
      };
      const stops = [...state.plan.stops];
      stops.splice(index, 0, newStop);
      const nextState: Snapshot = {
        ...cloneSnapshot(state),
        plan: {
          ...state.plan,
          stops,
          unbookedPool: state.plan.unbookedPool.filter((item) => item.id !== jobId),
        },
        pendingJobIds: state.pendingJobIds.filter((id) => id !== jobId),
        hasOptimised: true,
        manualOrderLock: true,
      };
      const previousTravel = applyResult(state, true).totalTravelMinutes;
      const result = applyResult(nextState, true);
      const impact = travelImpact(previousTravel, result);
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        jobs: state.jobs,
        pendingJobIds: nextState.pendingJobIds,
        plan: withTimedPlan(nextState.plan, result),
        hasOptimised: true,
        manualOrderLock: true,
        needsRecalculate: false,
        lastImpact: impact,
        impactMessage: describeTravelImpact(impact),
        selectedJobId: jobId,
        selectedKind: "stop",
        roadRouteStatus: "loading",
        roadRouteMessage: null,
      };
    });
    scheduleRoadRouteRefresh();
  },

  moveOutOfDay: (stopId) => {
    set((state) => {
      const stop = state.plan.stops.find((item) => item.id === stopId);
      if (!stop) return state;
      const job = state.jobs[stop.jobId];
      if (!job) return state;
      const snapshot = cloneSnapshot(state);
      const alreadyPooled = state.plan.unbookedPool.some((item) => item.id === job.id);
      const nextState: Snapshot = {
        ...cloneSnapshot(state),
        plan: {
          ...state.plan,
          stops: state.plan.stops.filter((item) => item.id !== stopId),
          unbookedPool: alreadyPooled
            ? state.plan.unbookedPool
            : [...state.plan.unbookedPool, structuredClone(job)],
        },
        selectedJobId: null,
        selectedKind: null,
      };
      const previousTravel = applyResult(state, true).totalTravelMinutes;
      const result = applyResult(nextState, true);
      const impact = travelImpact(previousTravel, result);
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        plan: withTimedPlan(nextState.plan, result),
        selectedJobId: null,
        selectedKind: null,
        lastImpact: impact,
        impactMessage: describeTravelImpact(impact),
        needsRecalculate: false,
        roadRouteStatus: "loading",
        roadRouteMessage: null,
      };
    });
    if (get().hasOptimised) scheduleRoadRouteRefresh();
  },

  removeStop: (stopId) => {
    get().moveOutOfDay(stopId);
  },

  runOptimise: () => {
    set((state) => {
      const snapshot = cloneSnapshot(state);
      const pendingJobs = state.pendingJobIds
        .map((id) => state.jobs[id])
        .filter((job): job is Job => Boolean(job?.address.trim()));
      const currentRouteJobs = routeJobsOf(state);
      const seen = new Set<string>();
      const candidates: Job[] = [];
      for (const job of [...currentRouteJobs, ...pendingJobs]) {
        if (seen.has(job.id)) continue;
        seen.add(job.id);
        candidates.push(job);
      }
      const jobsToRoute = candidates
        .filter((job) => jobHasResolvedLocation(job))
        .map((job) => {
          const duration = samplingDurationOf(job, state.plan.settings);
          return {
            ...job,
            samplingDurationMinutes: duration,
            estimatedMinutes: duration,
          };
        });
      const unlocatedJobIds = candidates
        .filter((job) => job.address.trim() && !jobHasResolvedLocation(job))
        .map((job) => job.id);
      if (jobsToRoute.length === 0) {
        return { ...state, unlocatedJobIds };
      }

      const result = optimiseDay({
        jobs: jobsToRoute,
        settings: state.plan.settings,
        existingStops: state.plan.stops,
        preserveOrder: false,
      });
      const routedIds = new Set(jobsToRoute.map((job) => job.id));
      const unlocatedSet = new Set(unlocatedJobIds);

      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        pendingJobIds: [],
        unlocatedJobIds,
        plan: {
          ...withTimedPlan(state.plan, result),
          unbookedPool: Object.values(state.jobs).filter(
            (job) =>
              !routedIds.has(job.id) &&
              !unlocatedSet.has(job.id) &&
              job.address.trim()
          ),
        },
        hasOptimised: true,
        manualOrderLock: false,
        needsRecalculate: false,
        lastImpact: null,
        impactMessage: null,
        selectedJobId: null,
        selectedKind: null,
        roadRouteStatus: "loading",
        roadRouteMessage: null,
      };
    });
    if (get().hasOptimised) scheduleRoadRouteRefresh();
  },

  planMyDay: async () => {
    const state = get();
    if (state.isPlanning) return;
    const pendingJobs = state.pendingJobIds
      .map((id) => state.jobs[id])
      .filter((job): job is Job => Boolean(job));
    const typed = pendingJobs.filter((job) => job.address.trim());
    if (typed.length === 0 && routeJobsOf(state).length === 0) return;

    const snapshot = cloneSnapshot(state);
    set({
      isPlanning: true,
      undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
    });

    const search = getPlanDaySearcher(searchAddressFromBrowser);
    const live = get();
    if (
      !pointOf(live.plan.settings.startLat, live.plan.settings.startLng) &&
      live.plan.settings.startLocation.trim()
    ) {
      const office = await resolveOfficeLocation(
        live.plan.settings.startLocation,
        search
      );
      if (office) {
        get().confirmPlanLocation("start", office);
        const finish = get().plan.settings;
        if (!pointOf(finish.finishLat, finish.finishLng)) {
          get().confirmPlanLocation("finish", office);
        }
      }
    }

    const planned = await planMyDayPipeline({
      jobs: typed,
      settings: get().plan.settings,
      search,
      existingStops: get().plan.stops,
      onProgress: (progress) => set({ planProgress: progress }),
    });

    const jobs = { ...get().jobs };
    for (const job of planned.jobs) jobs[job.id] = job;
    const unlocatedJobIds = planned.unlocatedJobs.map((job) => job.id);

    if (!planned.optimisation || planned.routedJobs.length === 0) {
      set({
        jobs,
        isPlanning: false,
        planProgress: planned.progress,
        unlocatedJobIds,
      });
      return;
    }

    const routedIds = new Set(planned.routedJobs.map((job) => job.id));
    const unlocatedSet = new Set(unlocatedJobIds);
    set({
      jobs,
      pendingJobIds: [],
      unlocatedJobIds,
      plan: {
        ...withTimedPlan(get().plan, planned.optimisation),
        unbookedPool: Object.values(jobs).filter(
          (job) =>
            !routedIds.has(job.id) &&
            !unlocatedSet.has(job.id) &&
            job.address.trim()
        ),
      },
      hasOptimised: true,
      isPlanning: false,
      planProgress: planned.progress,
      manualOrderLock: false,
      needsRecalculate: false,
      lastImpact: null,
      impactMessage: null,
      selectedJobId: null,
      selectedKind: null,
      roadRouteStatus: "loading",
      roadRouteMessage: null,
    });
    scheduleRoadRouteRefresh();
  },

  retryUnlocatedJob: async (jobId) => {
    const job = get().jobs[jobId];
    if (!job?.address.trim() || get().isPlanning) return;
    const search = getPlanDaySearcher(searchAddressFromBrowser);
    const planned = await planMyDayPipeline({
      jobs: [job],
      settings: get().plan.settings,
      search,
    });
    const updated = planned.jobs[0];
    if (!updated) return;
    if (jobHasResolvedLocation(updated) && updated.latitude != null && updated.longitude != null) {
      get().confirmGeocodedAddress(jobId, {
        id: updated.id,
        displayAddress: updated.resolvedDisplayAddress ?? updated.address,
        latitude: updated.latitude,
        longitude: updated.longitude,
        suburb: updated.suburb,
        state: undefined,
        postcode: undefined,
        country: "Australia",
        provider: updated.geocodingProvider ?? "nominatim",
      });
      return;
    }
    set((state) => ({
      jobs: { ...state.jobs, [jobId]: updated },
      unlocatedJobIds: state.unlocatedJobIds.includes(jobId)
        ? state.unlocatedJobIds
        : [...state.unlocatedJobIds, jobId],
    }));
  },

  recalculate: () => {
    set((state) => {
      if (!state.hasOptimised) return state;
      const snapshot = cloneSnapshot(state);
      const previousTravel = applyResult(state, true).totalTravelMinutes;
      const result = applyResult(state, state.manualOrderLock);
      const impact = travelImpact(previousTravel, result);
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        plan: withTimedPlan(state.plan, result),
        needsRecalculate: false,
        lastConstraintJobId: null,
        lastImpact: impact,
        impactMessage: describeTravelImpact(impact),
        manualOrderLock: state.manualOrderLock
          ? state.manualOrderLock
          : false,
        roadRouteStatus: "loading",
        roadRouteMessage: null,
      };
    });
    if (get().hasOptimised) scheduleRoadRouteRefresh();
  },

  reorderStop: (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    set((state) => {
      const snapshot = cloneSnapshot(state);
      const stops = [...state.plan.stops];
      const [moved] = stops.splice(fromIndex, 1);
      stops.splice(toIndex, 0, moved);
      const nextState: Snapshot = {
        ...cloneSnapshot(state),
        plan: {
          ...state.plan,
          stops: stops.map((stop, order) => ({
            ...stop,
            order,
            isManuallyOrdered: true,
          })),
        },
        manualOrderLock: true,
      };
      const previousTravel = applyResult(state, true).totalTravelMinutes;
      const result = applyResult(nextState, true);
      const impact = travelImpact(previousTravel, result);
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        plan: {
          ...withTimedPlan(nextState.plan, result),
          stops: result.stops.map((stop) => ({ ...stop, isManuallyOrdered: true })),
        },
        manualOrderLock: true,
        needsRecalculate: false,
        lastImpact: impact,
        impactMessage: describeTravelImpact(impact),
        roadRouteStatus: "loading",
        roadRouteMessage: null,
      };
    });
    scheduleRoadRouteRefresh();
  },

  updateJobConstraint: (jobId, constraint) => {
    set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      const snapshot = cloneSnapshot(state);
      const updated = { ...job, constraint };
      const onRoute = state.plan.stops.some((stop) => stop.jobId === jobId);
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        jobs: { ...state.jobs, [jobId]: updated },
        plan: {
          ...state.plan,
          unbookedPool: state.plan.unbookedPool.map((item) =>
            item.id === jobId ? updated : item
          ),
        },
        needsRecalculate: onRoute && state.hasOptimised,
        lastConstraintJobId: onRoute && state.hasOptimised ? jobId : null,
      };
    });
  },

  updateBookingStatus: (jobId, status) => {
    set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      const snapshot = cloneSnapshot(state);
      const updated = { ...job, bookingStatus: status };
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        jobs: { ...state.jobs, [jobId]: updated },
        plan: {
          ...state.plan,
          unbookedPool: state.plan.unbookedPool.map((item) =>
            item.id === jobId ? updated : item
          ),
        },
      };
    });
  },

  updateJobNotes: (jobId, notes) => {
    set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      const updated = { ...job, notes };
      return {
        jobs: { ...state.jobs, [jobId]: updated },
        plan: {
          ...state.plan,
          unbookedPool: state.plan.unbookedPool.map((item) =>
            item.id === jobId ? updated : item
          ),
        },
      };
    });
  },

  confirmSuggestedTime: (jobId) => {
    set((current) => {
      const stop = current.plan.stops.find((item) => item.jobId === jobId);
      const job = current.jobs[jobId];
      if (!stop?.suggestedArrival || !job) return current;
      const snapshot = cloneSnapshot(current);
      const updated: Job = {
        ...job,
        bookingStatus: "confirmed",
        constraint: { type: "fixed", time: stop.suggestedArrival },
      };
      const jobs = { ...current.jobs, [jobId]: updated };
      const result = applyResult({ ...current, jobs }, true);
      return {
        undoStack: [...current.undoStack, snapshot].slice(-MAX_UNDO),
        jobs,
        plan: withTimedPlan(current.plan, result),
        needsRecalculate: false,
      };
    });
  },

  applySlotSuggestion: (jobId, suggestion) => {
    set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      if (state.plan.stops.some((stop) => stop.jobId === jobId)) return state;
      const snapshot = cloneSnapshot(state);
      const updated: Job = {
        ...job,
        constraint: { type: "fixed", time: suggestion.appointmentTime },
        bookingStatus:
          job.bookingStatus === "uncontacted"
            ? "tentatively_booked"
            : job.bookingStatus,
      };
      const stops = [...state.plan.stops];
      stops.splice(suggestion.insertionIndex, 0, {
        id: `stop-${jobId}`,
        jobId,
        order: suggestion.insertionIndex,
        isManuallyOrdered: true,
      });
      const nextState: Snapshot = {
        ...cloneSnapshot(state),
        jobs: { ...state.jobs, [jobId]: updated },
        plan: {
          ...state.plan,
          stops,
          unbookedPool: state.plan.unbookedPool.filter((item) => item.id !== jobId),
        },
        pendingJobIds: state.pendingJobIds.filter((id) => id !== jobId),
        hasOptimised: true,
        manualOrderLock: true,
      };
      const previousTravel = applyResult(state, true).totalTravelMinutes;
      const result = applyResult(nextState, true);
      const impact = travelImpact(previousTravel, result);
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        jobs: nextState.jobs,
        pendingJobIds: nextState.pendingJobIds,
        plan: withTimedPlan(nextState.plan, result),
        hasOptimised: true,
        manualOrderLock: true,
        needsRecalculate: false,
        lastImpact: impact,
        impactMessage: describeTravelImpact(impact),
        selectedJobId: jobId,
        selectedKind: "stop",
        roadRouteStatus: "loading",
        roadRouteMessage: null,
      };
    });
    scheduleRoadRouteRefresh();
  },

  selectJob: (jobId, kind = null) => {
    set({ selectedJobId: jobId, selectedKind: jobId ? kind : null });
  },

  getSlotSuggestionsFor: (jobId) => {
    const state = get();
    const job = state.jobs[jobId];
    if (!job) return [];
    return getSlotSuggestions({
      job,
      routeJobs: routeJobsOf(state),
      settings: state.plan.settings,
      existingStops: state.plan.stops,
    });
  },

  getNearbyUnbooked: () => {
    const state = get();
    return getNearbyAlongRoute({
      unbooked: state.plan.unbookedPool,
      routeJobs: routeJobsOf(state),
      settings: state.plan.settings,
      existingStops: state.plan.stops,
    });
  },

  undo: () => {
    set((state) => {
      if (state.undoStack.length === 0) return state;
      const undoStack = [...state.undoStack];
      const previous = undoStack.pop();
      if (!previous) return state;
      return {
        ...previous,
        undoStack,
        lastImpact: null,
        impactMessage: null,
        lastConstraintJobId: null,
      };
    });
  },

  backToPlanning: () => {
    set((state) => {
      const snapshot = cloneSnapshot(state);
      const routedIds = state.plan.stops.map((stop) => stop.jobId);
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        pendingJobIds: [
          ...routedIds,
          ...state.unlocatedJobIds.filter((id) => !routedIds.includes(id)),
          ...state.pendingJobIds,
        ],
        unlocatedJobIds: [],
        plan: { ...state.plan, stops: [] },
        hasOptimised: false,
        isPlanning: false,
        planProgress: null,
        needsRecalculate: false,
        manualOrderLock: false,
        lastImpact: null,
        impactMessage: null,
        selectedJobId: null,
        selectedKind: null,
        ...EMPTY_ROAD,
      };
    });
    cancelScheduledRoadRoute();
  },

  dismissImpact: () => set({ impactMessage: null }),

  refreshRoadRoute: async (options) => {
    const token = ++roadRouteGeneration;
    const state = get();
    if (!state.hasOptimised || state.plan.stops.length === 0) {
      set({ ...EMPTY_ROAD });
      return;
    }
    const coords = drivingWaypoints({
      settings: state.plan.settings,
      stops: state.plan.stops,
      jobs: state.jobs,
    });
    if (!coords) {
      const estimated = applyResult(
        { ...cloneSnapshot(state), ...EMPTY_ROAD, roadRouteStatus: "fallback" },
        true
      );
      set({
        ...EMPTY_ROAD,
        roadRouteStatus: "fallback",
        roadRouteMessage: FALLBACK_ROUTE_MESSAGE,
        plan: withTimedPlan(state.plan, estimated),
      });
      return;
    }
    const key = routeCacheKey(coords);
    if (
      !options?.force &&
      state.roadRouteStatus === "live" &&
      state.roadRouteKey === key &&
      state.roadRoute
    ) {
      return;
    }
    set({ roadRouteStatus: "loading", roadRouteMessage: null });
    try {
      const route = await fetchRouteFromBrowser(coords);
      if (token !== roadRouteGeneration) return;
      const latest = get();
      const latestCoords = drivingWaypoints({
        settings: latest.plan.settings,
        stops: latest.plan.stops,
        jobs: latest.jobs,
      });
      if (!latestCoords || routeCacheKey(latestCoords) !== key) return;
      const withRoute: Snapshot = {
        ...cloneSnapshot(latest),
        roadRoute: route,
        roadRouteKey: key,
        roadRouteStatus: "live",
        roadRouteMessage: null,
      };
      const timed = applyResult(withRoute, true);
      set({
        roadRoute: route,
        roadRouteKey: key,
        roadRouteStatus: "live",
        roadRouteMessage: null,
        plan: withTimedPlan(latest.plan, timed),
      });
    } catch (error) {
      if (token !== roadRouteGeneration) return;
      const latest = get();
      const message =
        error instanceof Error && error.message.toLowerCase().includes("not configured")
          ? "Road routing key is missing on this host — using estimated travel."
          : FALLBACK_ROUTE_MESSAGE;
      const fallbackState: Snapshot = {
        ...cloneSnapshot(latest),
        ...EMPTY_ROAD,
        roadRouteStatus: "fallback",
        roadRouteMessage: message,
      };
      const timed = applyResult(fallbackState, true);
      set({
        ...EMPTY_ROAD,
        roadRouteStatus: "fallback",
        roadRouteMessage: message,
        plan: withTimedPlan(latest.plan, timed),
      });
    }
  },

  rerouteRoad: () => {
    void get().refreshRoadRoute({ force: true });
  },

  loadScenario: (id) => {
    const scenario = getValidationScenario(id);
    if (!scenario) return false;
    const loaded = materialiseScenario(scenario);
    set({
      jobs: loaded.jobs,
      pendingJobIds: loaded.pendingJobIds,
      plan: loaded.plan,
      hasOptimised: loaded.hasOptimised,
      selectedJobId: null,
      selectedKind: null,
      needsRecalculate: false,
      manualOrderLock: false,
      lastImpact: null,
      impactMessage: null,
      lastConstraintJobId: null,
      undoStack: [],
      activeScenarioId: scenario.id,
      isPlanning: false,
      planProgress: null,
      unlocatedJobIds: [],
      ...EMPTY_ROAD,
    });
    return true;
  },
}));

export function getJob(state: DayRouteState, jobId: string): Job | undefined {
  return state.jobs[jobId];
}

export function resetDayRouteStore(): void {
  cancelScheduledRoadRoute();
  const fresh = createDemoPlan();
  useDayRouteStore.setState({
    jobs: fresh.jobs,
    pendingJobIds: fresh.pendingJobIds,
    plan: fresh.plan,
    selectedJobId: null,
    selectedKind: null,
    needsRecalculate: false,
    hasOptimised: false,
    manualOrderLock: false,
    activeScenarioId: null,
    lastImpact: null,
    impactMessage: null,
    lastConstraintJobId: null,
    undoStack: [],
    isPlanning: false,
    planProgress: null,
    unlocatedJobIds: [],
    ...EMPTY_ROAD,
  });
}
