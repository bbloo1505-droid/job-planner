import { create } from "zustand";
import { geocodeAddress } from "@/lib/geo";
import { addMinutes } from "@/lib/routing/round-time";
import { createTeamDemo } from "@/lib/team/dummy-data";
import { parseQuickEntry } from "@/lib/team/parse-quick-entry";
import { DEMO_WEEK_MONDAY, mondayIso, shiftWeek } from "@/lib/team/week";
import type {
  Allocation,
  Consultant,
  Job,
  Priority,
} from "@/lib/types";

const MAX_UNDO = 40;

export type TeamView = "planner" | "map" | "split";
export type GeoScope = string | "week";

interface Snapshot {
  jobs: Record<string, Job>;
  allocations: Allocation[];
}

export interface TeamPlannerState extends Snapshot {
  consultants: Consultant[];
  weekStart: string;
  selectedJobId: string | null;
  selectedDate: string | null;
  selectedConsultantId: string | null;
  view: TeamView;
  geoScope: GeoScope;
  mapHiddenConsultantIds: string[];
  allocationPreview: { jobId: string; consultantId: string; date: string } | null;
  search: string;
  priorityFilter: Priority | "all";
  dueThisWeekOnly: boolean;
  consultantFilter: string | "all";
  editingCell: { consultantId: string; date: string } | null;
  undoStack: Snapshot[];
  quickAdd: (consultantId: string, date: string, text: string) => string | null;
  moveAllocation: (allocationId: string, consultantId: string, date: string, order?: number) => void;
  assignJob: (jobId: string, consultantId: string, date: string, order?: number) => void;
  unassign: (allocationId: string) => void;
  unassignJob: (jobId: string) => void;
  deleteJob: (jobId: string) => void;
  updateJob: (jobId: string, patch: Partial<Job>) => void;
  updateAllocation: (allocationId: string, patch: Partial<Allocation>) => void;
  reorderInCell: (consultantId: string, date: string, fromIndex: number, toIndex: number) => void;
  selectJob: (jobId: string | null) => void;
  selectDate: (date: string | null) => void;
  selectConsultant: (consultantId: string | null) => void;
  setView: (view: TeamView) => void;
  setGeoScope: (scope: GeoScope) => void;
  toggleMapConsultantHidden: (consultantId: string) => void;
  isolateMapConsultant: (consultantId: string) => void;
  setAllocationPreview: (
    preview: { jobId: string; consultantId: string; date: string } | null
  ) => void;
  setSearch: (value: string) => void;
  setPriorityFilter: (value: Priority | "all") => void;
  setDueThisWeekOnly: (value: boolean) => void;
  setConsultantFilter: (value: string | "all") => void;
  setEditingCell: (cell: { consultantId: string; date: string } | null) => void;
  goWeek: (delta: number) => void;
  goToday: () => void;
  undo: () => void;
}

function cloneSnap(state: Snapshot): Snapshot {
  return {
    jobs: structuredClone(state.jobs),
    allocations: structuredClone(state.allocations),
  };
}

function nextJobNumber(jobs: Record<string, Job>): string {
  let max = 130;
  for (const job of Object.values(jobs)) {
    const match = job.jobNumber?.match(/PR-TEST-(\d+)/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `PR-TEST-${String(max + 1).padStart(3, "0")}`;
}

function minutesForTitle(title?: string): number {
  if (title === "Hazmat Survey") return 120;
  if (title === "ACM Survey") return 90;
  if (title === "Site Inspection") return 75;
  if (title === "Reinspection") return 45;
  if (title === "Air Monitoring" || title === "Sampling") return 60;
  return 90;
}

function cellAllocations(
  allocations: Allocation[],
  consultantId: string,
  date: string
): Allocation[] {
  return allocations
    .filter((item) => item.consultantId === consultantId && item.scheduledDate === date)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}

function reindex(items: Allocation[]): Allocation[] {
  return items.map((item, order) => ({ ...item, order }));
}

const demo = createTeamDemo();

export const useTeamPlannerStore = create<TeamPlannerState>((set, get) => ({
  consultants: demo.consultants,
  jobs: demo.jobs,
  allocations: demo.allocations,
  weekStart: DEMO_WEEK_MONDAY,
  selectedJobId: null,
  selectedDate: DEMO_WEEK_MONDAY,
  selectedConsultantId: null,
  view: "planner",
  geoScope: DEMO_WEEK_MONDAY,
  mapHiddenConsultantIds: [],
  allocationPreview: null,
  search: "",
  priorityFilter: "all",
  dueThisWeekOnly: false,
  consultantFilter: "all",
  editingCell: null,
  undoStack: [],

  quickAdd: (consultantId, date, text) => {
    const parsed = parseQuickEntry(text);
    if (!parsed.address.trim() && !parsed.title) return null;
    const id = crypto.randomUUID();
    set((state) => {
      const snapshot = cloneSnap(state);
      const geo = geocodeAddress(parsed.address);
      const title = parsed.title;
      const job: Job = {
        id,
        address: geo?.address ?? parsed.address,
        suburb: geo?.suburb,
        latitude: geo?.lat,
        longitude: geo?.lng,
        estimatedMinutes: minutesForTitle(title),
        constraint: parsed.time ? { type: "fixed", time: parsed.time } : { type: "flexible" },
        bookingStatus: "uncontacted",
        priority: "normal",
        jobNumber: nextJobNumber(state.jobs),
        client: "Sample Client A",
        title,
        workCategory: "proposed_work",
      };
      const siblings = cellAllocations(state.allocations, consultantId, date);
      const allocation: Allocation = {
        id: `al-${id}`,
        jobId: id,
        consultantId,
        scheduledDate: date,
        startTime: parsed.time,
        endTime: parsed.time
          ? addMinutes(parsed.time, job.estimatedMinutes)
          : undefined,
        order: siblings.length,
      };
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        jobs: { ...state.jobs, [id]: job },
        allocations: [...state.allocations, allocation],
        editingCell: null,
        selectedJobId: id,
      };
    });
    return id;
  },

  moveAllocation: (allocationId, consultantId, date, order) => {
    set((state) => {
      const current = state.allocations.find((item) => item.id === allocationId);
      if (!current) return state;
      if (
        current.consultantId === consultantId &&
        current.scheduledDate === date &&
        order === undefined
      ) {
        return state;
      }
      const snapshot = cloneSnap(state);
      const without = state.allocations.filter((item) => item.id !== allocationId);
      const target = cellAllocations(without, consultantId, date);
      const insertAt = Math.min(order ?? target.length, target.length);
      const moved: Allocation = {
        ...current,
        consultantId,
        scheduledDate: date,
        order: insertAt,
      };
      target.splice(insertAt, 0, moved);
      const rest = without.filter(
        (item) => !(item.consultantId === consultantId && item.scheduledDate === date)
      );
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        allocations: [...rest, ...reindex(target)],
        selectedJobId: current.jobId,
      };
    });
  },

  assignJob: (jobId, consultantId, date, order) => {
    const existing = get().allocations.find((item) => item.jobId === jobId);
    if (existing) {
      get().moveAllocation(existing.id, consultantId, date, order);
      return;
    }
    set((state) => {
      if (!state.jobs[jobId]) return state;
      const snapshot = cloneSnap(state);
      const job = state.jobs[jobId];
      const siblings = cellAllocations(state.allocations, consultantId, date);
      const insertAt = Math.min(order ?? siblings.length, siblings.length);
      const allocation: Allocation = {
        id: `al-${jobId}`,
        jobId,
        consultantId,
        scheduledDate: date,
        startTime: job.constraint.type === "fixed" ? job.constraint.time : undefined,
        order: insertAt,
      };
      siblings.splice(insertAt, 0, allocation);
      const rest = state.allocations.filter(
        (item) => !(item.consultantId === consultantId && item.scheduledDate === date)
      );
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        allocations: [...rest, ...reindex(siblings)],
        selectedJobId: jobId,
        allocationPreview: null,
      };
    });
  },

  unassign: (allocationId) => {
    set((state) => {
      if (!state.allocations.some((item) => item.id === allocationId)) return state;
      const snapshot = cloneSnap(state);
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        allocations: state.allocations.filter((item) => item.id !== allocationId),
      };
    });
  },

  unassignJob: (jobId) => {
    const allocation = get().allocations.find((item) => item.jobId === jobId);
    if (allocation) get().unassign(allocation.id);
  },

  deleteJob: (jobId) => {
    set((state) => {
      if (!state.jobs[jobId]) return state;
      const snapshot = cloneSnap(state);
      const jobs = { ...state.jobs };
      delete jobs[jobId];
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        jobs,
        allocations: state.allocations.filter((item) => item.jobId !== jobId),
        selectedJobId: state.selectedJobId === jobId ? null : state.selectedJobId,
      };
    });
  },

  updateJob: (jobId, patch) => {
    set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      const snapshot = cloneSnap(state);
      const next = { ...job, ...patch };
      if (patch.address && patch.address !== job.address) {
        const geo = geocodeAddress(patch.address);
        next.address = geo?.address ?? patch.address;
        next.suburb = geo?.suburb;
        next.latitude = geo?.lat;
        next.longitude = geo?.lng;
      }
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        jobs: { ...state.jobs, [jobId]: next },
      };
    });
  },

  updateAllocation: (allocationId, patch) => {
    set((state) => {
      const current = state.allocations.find((item) => item.id === allocationId);
      if (!current) return state;
      const snapshot = cloneSnap(state);
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        allocations: state.allocations.map((item) =>
          item.id === allocationId ? { ...item, ...patch } : item
        ),
      };
    });
  },

  reorderInCell: (consultantId, date, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    set((state) => {
      const snapshot = cloneSnap(state);
      const cell = cellAllocations(state.allocations, consultantId, date);
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= cell.length || toIndex >= cell.length) {
        return state;
      }
      const [moved] = cell.splice(fromIndex, 1);
      cell.splice(toIndex, 0, moved);
      const rest = state.allocations.filter(
        (item) => !(item.consultantId === consultantId && item.scheduledDate === date)
      );
      return {
        undoStack: [...state.undoStack, snapshot].slice(-MAX_UNDO),
        allocations: [...rest, ...reindex(cell)],
      };
    });
  },

  selectJob: (jobId) =>
    set((state) => ({
      selectedJobId: jobId,
      allocationPreview:
        jobId && state.allocationPreview?.jobId === jobId ? state.allocationPreview : null,
    })),
  selectDate: (date) =>
    set({
      selectedDate: date,
      geoScope: date ?? "week",
    }),
  selectConsultant: (consultantId) =>
    set((state) => ({
      selectedConsultantId:
        state.selectedConsultantId === consultantId ? null : consultantId,
    })),
  setView: (view) => set({ view }),
  setGeoScope: (geoScope) =>
    set((state) => ({
      geoScope,
      selectedDate: geoScope === "week" ? state.selectedDate : geoScope,
    })),
  toggleMapConsultantHidden: (consultantId) =>
    set((state) => {
      const hidden = state.mapHiddenConsultantIds.includes(consultantId);
      return {
        mapHiddenConsultantIds: hidden
          ? state.mapHiddenConsultantIds.filter((id) => id !== consultantId)
          : [...state.mapHiddenConsultantIds, consultantId],
      };
    }),
  isolateMapConsultant: (consultantId) =>
    set((state) => {
      const others = state.consultants
        .filter((item) => item.id !== consultantId)
        .map((item) => item.id);
      const alreadyIsolated =
        others.length > 0 &&
        others.every((id) => state.mapHiddenConsultantIds.includes(id)) &&
        !state.mapHiddenConsultantIds.includes(consultantId);
      return {
        mapHiddenConsultantIds: alreadyIsolated ? [] : others,
        selectedConsultantId: consultantId,
      };
    }),
  setAllocationPreview: (allocationPreview) => set({ allocationPreview }),
  setSearch: (search) => set({ search }),
  setPriorityFilter: (priorityFilter) => set({ priorityFilter }),
  setDueThisWeekOnly: (dueThisWeekOnly) => set({ dueThisWeekOnly }),
  setConsultantFilter: (consultantFilter) => set({ consultantFilter }),
  setEditingCell: (editingCell) => set({ editingCell }),
  goWeek: (delta) =>
    set((state) => {
      const weekStart = shiftWeek(state.weekStart, delta);
      return {
        weekStart,
        selectedDate: weekStart,
        geoScope: weekStart,
        editingCell: null,
      };
    }),
  goToday: () =>
    set({
      weekStart: mondayIso(new Date()),
      selectedDate: mondayIso(new Date()),
      geoScope: mondayIso(new Date()),
      editingCell: null,
    }),
  undo: () => {
    set((state) => {
      if (state.undoStack.length === 0) return state;
      const undoStack = [...state.undoStack];
      const previous = undoStack.pop();
      if (!previous) return state;
      return { ...previous, undoStack, allocationPreview: null };
    });
  },
}));

export function unassignedJobs(state: Pick<TeamPlannerState, "jobs" | "allocations">): Job[] {
  const assigned = new Set(state.allocations.map((item) => item.jobId));
  return Object.values(state.jobs).filter((job) => !assigned.has(job.id));
}

export function allocationForJob(
  state: Pick<TeamPlannerState, "allocations">,
  jobId: string
): Allocation | undefined {
  return state.allocations.find((item) => item.jobId === jobId);
}

export function resetTeamPlannerStore(): void {
  const fresh = createTeamDemo();
  useTeamPlannerStore.setState({
    consultants: fresh.consultants,
    jobs: fresh.jobs,
    allocations: fresh.allocations,
    weekStart: DEMO_WEEK_MONDAY,
    selectedJobId: null,
    selectedDate: DEMO_WEEK_MONDAY,
    selectedConsultantId: null,
    view: "planner",
    geoScope: DEMO_WEEK_MONDAY,
    mapHiddenConsultantIds: [],
    allocationPreview: null,
    search: "",
    priorityFilter: "all",
    dueThisWeekOnly: false,
    consultantFilter: "all",
    editingCell: null,
    undoStack: [],
  });
}
