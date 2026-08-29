import { create } from "zustand";
import { createDemoPlan, DEFAULT_SETTINGS } from "@/lib/dummy-data";
import { geocodeAddress } from "@/lib/geo";
import { parseAddressLines } from "@/lib/parse-addresses";
import { getNearbyAlongRoute } from "@/lib/routing/nearby-along-route";
import {
  describeTravelImpact,
  optimiseDay,
  travelImpact,
} from "@/lib/routing/optimise-day";
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
  Job,
  NearbyMatch,
  SlotSuggestion,
  TravelImpact,
} from "@/lib/types";

const MAX_UNDO = 20;

type SelectedKind = "stop" | "unbooked" | null;

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
}

export interface DayRouteState extends Snapshot {
  lastImpact: TravelImpact | null;
  impactMessage: string | null;
  lastConstraintJobId: string | null;
  undoStack: Snapshot[];
  initDayPlan: (date: string) => void;
  updateSettings: (partial: Partial<DayPlanSettings>) => void;
  bulkAddAddresses: (text: string) => number;
  addPendingAddress: () => string;
  updatePendingJob: (jobId: string, address: string) => void;
  removePendingJob: (jobId: string) => void;
  addStop: (jobId: string, insertionIndex?: number) => void;
  /** Remove a stop from today and return the job to the unbooked pool. */
  moveOutOfDay: (stopId: string) => void;
  /** @deprecated Use moveOutOfDay — kept so existing call sites keep working. */
  removeStop: (stopId: string) => void;
  runOptimise: () => void;
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

function newJob(jobs: Record<string, Job>, address: string): Job {
  const geo = geocodeAddress(address);
  return {
    id: crypto.randomUUID(),
    address: geo?.address ?? address,
    suburb: geo?.suburb,
    latitude: geo?.lat,
    longitude: geo?.lng,
    estimatedMinutes: DEFAULT_SETTINGS.visitDurationMinutes,
    constraint: { type: "flexible" },
    bookingStatus: "uncontacted",
    priority: "normal",
    jobNumber: nextJobNumber(jobs),
    client: "Sample Client A",
  };
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
  });
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
    });
  },

  updateSettings: (partial) => {
    const next = { ...partial };
    if (partial.startLocation) {
      const geo = geocodeAddress(partial.startLocation);
      next.startLat = geo?.lat;
      next.startLng = geo?.lng;
    }
    if (partial.finishLocation) {
      const geo = geocodeAddress(partial.finishLocation);
      next.finishLat = geo?.lat;
      next.finishLng = geo?.lng;
    }
    set((state) => ({
      plan: {
        ...state.plan,
        settings: { ...state.plan.settings, ...next },
      },
      needsRecalculate: state.hasOptimised,
    }));
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
        const job = newJob(jobs, line);
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
      const job: Job = {
        id,
        address: "",
        suburb: "",
        estimatedMinutes: state.plan.settings.visitDurationMinutes,
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
      const geo = geocodeAddress(address);
      return {
        jobs: {
          ...state.jobs,
          [jobId]: {
            ...job,
            address: geo?.address ?? address,
            suburb: geo?.suburb,
            latitude: geo?.lat,
            longitude: geo?.lng,
          },
        },
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
        plan: { ...nextState.plan, stops: result.stops },
        hasOptimised: true,
        manualOrderLock: true,
        needsRecalculate: false,
        lastImpact: impact,
        impactMessage: describeTravelImpact(impact),
        selectedJobId: jobId,
        selectedKind: "stop",
      };
    });
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
        plan: { ...nextState.plan, stops: result.stops },
        selectedJobId: null,
        selectedKind: null,
        lastImpact: impact,
        impactMessage: describeTravelImpact(impact),
        needsRecalculate: false,
      };
    });
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
      const jobsToRoute: Job[] = [];
      for (const job of [...currentRouteJobs, ...pendingJobs]) {
        if (seen.has(job.id)) continue;
        seen.add(job.id);
        jobsToRoute.push({
          ...job,
          estimatedMinutes: job.estimatedMinutes || state.plan.settings.visitDurationMinutes,
        });
      }
      if (jobsToRoute.length === 0) return state;

      const result = optimiseDay({
        jobs: jobsToRoute,
        settings: state.plan.settings,
        existingStops: state.plan.stops,
        preserveOrder: false,
      });
      const routedIds = new Set(jobsToRoute.map((job) => job.id));

      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        pendingJobIds: [],
        plan: {
          ...state.plan,
          stops: result.stops,
          unbookedPool: Object.values(state.jobs).filter(
            (job) => !routedIds.has(job.id) && job.address.trim()
          ),
        },
        hasOptimised: true,
        manualOrderLock: false,
        needsRecalculate: false,
        lastImpact: null,
        impactMessage: null,
        selectedJobId: null,
        selectedKind: null,
      };
    });
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
        plan: { ...state.plan, stops: result.stops },
        needsRecalculate: false,
        lastConstraintJobId: null,
        lastImpact: impact,
        impactMessage: describeTravelImpact(impact),
        manualOrderLock: state.manualOrderLock
          ? state.manualOrderLock
          : false,
      };
    });
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
          ...nextState.plan,
          stops: result.stops.map((stop) => ({ ...stop, isManuallyOrdered: true })),
        },
        manualOrderLock: true,
        needsRecalculate: false,
        lastImpact: impact,
        impactMessage: describeTravelImpact(impact),
      };
    });
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
        plan: { ...current.plan, stops: result.stops },
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
        plan: { ...nextState.plan, stops: result.stops },
        hasOptimised: true,
        manualOrderLock: true,
        needsRecalculate: false,
        lastImpact: impact,
        impactMessage: describeTravelImpact(impact),
        selectedJobId: jobId,
        selectedKind: "stop",
      };
    });
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
        pendingJobIds: [...routedIds, ...state.pendingJobIds],
        plan: { ...state.plan, stops: [] },
        hasOptimised: false,
        needsRecalculate: false,
        manualOrderLock: false,
        lastImpact: null,
        impactMessage: null,
        selectedJobId: null,
        selectedKind: null,
      };
    });
  },

  dismissImpact: () => set({ impactMessage: null }),

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
    });
    return true;
  },
}));

export function getJob(state: DayRouteState, jobId: string): Job | undefined {
  return state.jobs[jobId];
}

export function resetDayRouteStore(): void {
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
  });
}
