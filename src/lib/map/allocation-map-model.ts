import { format, parseISO } from "date-fns";
import { pointOf } from "@/lib/geo";
import { orderedFieldJobsForDay } from "@/lib/geo/insertion-cost";
import {
  rankAllocationCandidates,
  type AllocationCandidate,
} from "@/lib/geo/rank-allocation-candidates";
import { allocationForJob, unassignedJobs } from "@/lib/store/team-planner-store";
import type { GeoScope } from "@/lib/store/team-planner-store";
import type {
  Allocation,
  Consultant,
  GeoPoint,
  Job,
  Priority,
  WorkCategory,
} from "@/lib/types";

export interface MapMarkerModel {
  id: string;
  kind: "scheduled" | "unassigned";
  lat: number;
  lng: number;
  colour: string;
  initials: string;
  consultantId: string | null;
  consultantName: string;
  label: string;
  title?: string;
  jobNumber?: string;
  date?: string;
  startTime?: string;
  workCategory?: WorkCategory;
  priority: Priority;
  dueDate?: string;
  selected: boolean;
  opacity: number;
  matchRank: number | null;
  dayLabel?: string;
}

export interface CandidateLinkModel {
  id: string;
  rank: number;
  from: GeoPoint;
  to: GeoPoint;
}

export interface InsertionStopModel {
  id: string;
  lat: number;
  lng: number;
  label: string;
  inserted: boolean;
}

export interface InsertionPreviewModel {
  consultantId: string;
  date: string;
  existing: InsertionStopModel[];
  proposed: InsertionStopModel[];
}

export interface WeeklyPathModel {
  consultantId: string;
  colour: string;
  points: { id: string; lat: number; lng: number; date: string }[];
}

export interface AllocationPreviewKey {
  jobId: string;
  consultantId: string;
  date: string;
}

export interface AllocationMapModel {
  markers: MapMarkerModel[];
  candidateLinks: CandidateLinkModel[];
  insertionPreview: InsertionPreviewModel | null;
  weeklyPath: WeeklyPathModel | null;
  topMatches: AllocationCandidate[];
  activeMatch: AllocationCandidate | null;
}

export function jobsToGeoJSON(markers: MapMarkerModel[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: markers.map((item) => ({
      type: "Feature",
      id: item.id,
      properties: {
        id: item.id,
        kind: item.kind,
        colour: item.colour,
        initials: item.initials,
        consultantId: item.consultantId,
        consultantName: item.consultantName,
        label: item.label,
        title: item.title ?? "",
        jobNumber: item.jobNumber ?? "",
        date: item.date ?? "",
        startTime: item.startTime ?? "",
        workCategory: item.workCategory ?? "",
        priority: item.priority,
        dueDate: item.dueDate ?? "",
        selected: item.selected,
        opacity: item.opacity,
        matchRank: item.matchRank,
        dayLabel: item.dayLabel ?? "",
      },
      geometry: {
        type: "Point",
        coordinates: [item.lng, item.lat],
      },
    })),
  };
}

export function buildInsertionPreview(input: {
  job: Job;
  candidate: AllocationCandidate;
  jobs: Record<string, Job>;
  allocations: Allocation[];
}): InsertionPreviewModel | null {
  const existingJobs = orderedFieldJobsForDay({
    consultantId: input.candidate.consultantId,
    date: input.candidate.date,
    allocations: input.allocations,
    jobs: input.jobs,
    excludeJobId: input.job.id,
  });
  const existing = existingJobs
    .map((item) => stopFromJob(item, false))
    .filter((item): item is InsertionStopModel => item != null);
  const inserted = stopFromJob(input.job, true);
  if (!inserted) return null;
  const proposed = [...existing];
  const index = Math.max(0, Math.min(input.candidate.insertionIndex, proposed.length));
  proposed.splice(index, 0, inserted);
  return {
    consultantId: input.candidate.consultantId,
    date: input.candidate.date,
    existing,
    proposed,
  };
}

export function buildAllocationMapModel(input: {
  jobs: Record<string, Job>;
  allocations: Allocation[];
  consultants: Consultant[];
  geoScope: GeoScope;
  hiddenConsultantIds: string[];
  selectedJobId: string | null;
  selectedConsultantId: string | null;
  workingDays: string[];
  allocationPreview: AllocationPreviewKey | null;
}): AllocationMapModel {
  const hidden = new Set(input.hiddenConsultantIds);
  const selectedJob = input.selectedJobId ? input.jobs[input.selectedJobId] : undefined;
  const selectedAllocation = selectedJob
    ? allocationForJob({ allocations: input.allocations }, selectedJob.id)
    : undefined;
  const matchMode = Boolean(selectedJob && !selectedAllocation);

  const matches =
    selectedJob && !selectedAllocation
      ? rankAllocationCandidates({
          job: selectedJob,
          consultants: input.consultants,
          jobs: input.jobs,
          allocations: input.allocations,
          workingDays: input.workingDays,
        })
      : [];
  const topMatches = matches.filter((item) => item.feasible).slice(0, 3);
  const activeMatch = pickActiveMatch(topMatches, matches, input.allocationPreview, selectedJob?.id);

  const matchJobIds = new Set<string>();
  for (const item of topMatches) {
    if (item.existingJobId) matchJobIds.add(item.existingJobId);
    if (item.previousJobId) matchJobIds.add(item.previousJobId);
    if (item.nextJobId) matchJobIds.add(item.nextJobId);
  }
  const nearConsultantIds = new Set(topMatches.map((item) => item.consultantId));
  const rankByJobId = new Map<string, number>();
  topMatches.forEach((item, index) => {
    const anchor = item.existingJobId ?? item.previousJobId ?? item.nextJobId;
    if (anchor) rankByJobId.set(anchor, index + 1);
  });

  const colourByConsultant = Object.fromEntries(
    input.consultants.map((item) => [item.id, item.displayColour])
  );
  const nameByConsultant = Object.fromEntries(
    input.consultants.map((item) => [item.id, item.name])
  );
  const initialsByConsultant = Object.fromEntries(
    input.consultants.map((item) => [item.id, item.initials])
  );

  const weekFocus = input.geoScope === "week" && Boolean(input.selectedConsultantId);
  const markers: MapMarkerModel[] = [];

  for (const allocation of input.allocations) {
    if (hidden.has(allocation.consultantId)) continue;
    const onScope = input.geoScope === "week" || allocation.scheduledDate === input.geoScope;
    const matchAnchor = matchMode && matchJobIds.has(allocation.jobId);
    if (!onScope && !matchAnchor) continue;
    const job = input.jobs[allocation.jobId];
    const point = job ? pointOf(job.latitude, job.longitude) : null;
    if (!job || !point) continue;
    const focused = input.selectedConsultantId === allocation.consultantId;
    let opacity = 1;
    if (matchMode) {
      opacity = nearConsultantIds.has(allocation.consultantId) ? 1 : 0.34;
    } else if (input.selectedConsultantId) {
      opacity = focused ? 1 : 0.28;
    }
    markers.push({
      id: job.id,
      kind: "scheduled",
      lat: point.lat,
      lng: point.lng,
      colour: colourByConsultant[allocation.consultantId] ?? "#64748b",
      initials: initialsByConsultant[allocation.consultantId] ?? "?",
      consultantId: allocation.consultantId,
      consultantName: nameByConsultant[allocation.consultantId] ?? "Consultant",
      label: job.suburb ?? job.title ?? "Job",
      title: job.title,
      jobNumber: job.jobNumber,
      date: allocation.scheduledDate,
      startTime: allocation.startTime,
      workCategory: job.workCategory,
      priority: (job.priority ?? "normal") as Priority,
      dueDate: job.dueDate,
      selected: input.selectedJobId === job.id,
      opacity,
      matchRank: rankByJobId.get(job.id) ?? null,
      dayLabel: weekFocus ? format(parseISO(allocation.scheduledDate), "EEE").toUpperCase() : undefined,
    });
  }

  for (const job of unassignedJobs({ jobs: input.jobs, allocations: input.allocations })) {
    const point = pointOf(job.latitude, job.longitude);
    if (!point) continue;
    const selected = input.selectedJobId === job.id;
    let opacity = 0.72;
    if (matchMode) opacity = selected ? 1 : 0.2;
    else if (input.selectedConsultantId) opacity = 0.62;
    markers.push({
      id: job.id,
      kind: "unassigned",
      lat: point.lat,
      lng: point.lng,
      colour: "#9a5a58",
      initials: "",
      consultantId: null,
      consultantName: "Unassigned",
      label: job.suburb ?? "Unassigned",
      title: job.title,
      jobNumber: job.jobNumber,
      workCategory: job.workCategory,
      priority: (job.priority ?? "normal") as Priority,
      dueDate: job.dueDate,
      selected,
      opacity,
      matchRank: null,
    });
  }

  const origin = selectedJob ? pointOf(selectedJob.latitude, selectedJob.longitude) : null;
  const candidateLinks: CandidateLinkModel[] = [];
  if (matchMode && origin) {
    topMatches.forEach((item, index) => {
      const targets = [item.previousJobId, item.nextJobId, item.existingJobId].filter(
        (id, pos, all): id is string => Boolean(id) && all.indexOf(id) === pos
      );
      for (const targetId of targets) {
        const dest = markers.find((marker) => marker.id === targetId);
        if (!dest) continue;
        candidateLinks.push({
          id: `${item.consultantId}-${item.date}-${targetId}`,
          rank: index + 1,
          from: origin,
          to: { lat: dest.lat, lng: dest.lng },
        });
      }
    });
  }

  const insertionPreview =
    matchMode && selectedJob && activeMatch
      ? buildInsertionPreview({
          job: selectedJob,
          candidate: activeMatch,
          jobs: input.jobs,
          allocations: input.allocations,
        })
      : null;

  let weeklyPath: WeeklyPathModel | null = null;
  if (weekFocus && input.selectedConsultantId) {
    const points = markers
      .filter(
        (item) => item.kind === "scheduled" && item.consultantId === input.selectedConsultantId
      )
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.id.localeCompare(b.id))
      .map((item) => ({
        id: item.id,
        lat: item.lat,
        lng: item.lng,
        date: item.date ?? "",
      }));
    if (points.length >= 2) {
      weeklyPath = {
        consultantId: input.selectedConsultantId,
        colour: colourByConsultant[input.selectedConsultantId] ?? "#64748b",
        points,
      };
    }
  }

  return {
    markers,
    candidateLinks,
    insertionPreview,
    weeklyPath,
    topMatches,
    activeMatch,
  };
}

export function locationsForFit(input: {
  model: AllocationMapModel;
  selectedConsultantId: string | null;
  matchMode: boolean;
}): GeoPoint[] {
  const { model, selectedConsultantId, matchMode } = input;
  if (matchMode) {
    const ids = new Set<string>();
    const points: GeoPoint[] = [];
    for (const marker of model.markers) {
      if (marker.kind === "unassigned" && marker.selected) {
        points.push(marker);
        ids.add(marker.id);
      }
      if (marker.matchRank != null && !ids.has(marker.id)) {
        points.push(marker);
        ids.add(marker.id);
      }
    }
    if (model.insertionPreview) {
      for (const stop of model.insertionPreview.proposed) {
        if (!ids.has(stop.id)) {
          points.push(stop);
          ids.add(stop.id);
        }
      }
    }
    if (points.length > 0) return points;
  }
  if (selectedConsultantId) {
    const focused = model.markers.filter(
      (item) => item.consultantId === selectedConsultantId || item.kind === "unassigned"
    );
    if (focused.length > 0) return focused;
  }
  return model.markers;
}

export function searchMapMarkers(markers: MapMarkerModel[], query: string): MapMarkerModel[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return markers.filter((item) => {
    const hay = `${item.label} ${item.jobNumber} ${item.title ?? ""} ${item.consultantName}`.toLowerCase();
    return hay.includes(q);
  });
}

function pickActiveMatch(
  topMatches: AllocationCandidate[],
  all: AllocationCandidate[],
  preview: AllocationPreviewKey | null,
  jobId?: string
): AllocationCandidate | null {
  if (preview && preview.jobId === jobId) {
    const found = all.find(
      (item) => item.consultantId === preview.consultantId && item.date === preview.date
    );
    if (found) return found;
  }
  return topMatches[0] ?? all.find((item) => item.feasible) ?? null;
}

function stopFromJob(job: Job, inserted: boolean): InsertionStopModel | null {
  const point = pointOf(job.latitude, job.longitude);
  if (!point) return null;
  return {
    id: job.id,
    lat: point.lat,
    lng: point.lng,
    label: job.suburb ?? job.address,
    inserted,
  };
}
