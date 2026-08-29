import { haversineDistanceKm, pointOf } from "@/lib/geo";
import { isFieldJob } from "@/lib/geo/insertion-cost";
import { AVG_SEQ_URBAN_KMH } from "@/lib/routing/travel";
import { dueStateLabel } from "@/lib/team/due-label";
import { monthWorkingIsoDates } from "@/lib/team/month";
import { isoDate, weekDays } from "@/lib/team/week";
import type { Allocation, Job, Priority } from "@/lib/types";

export type ReportPeriod = "week" | "month" | "all";

export interface ReportSlice {
  key: string;
  label: string;
  value: number;
  percent: number;
  color: string;
}

export interface LocationCount {
  name: string;
  count: number;
}

export interface TeamReport {
  totalJobs: number;
  scheduledJobs: number;
  unassignedJobs: number;
  completedJobs: number;
  atRiskJobs: number;
  travelSavedKm: number;
  travelSavedMinutes: number;
  byPriority: ReportSlice[];
  byStatus: ReportSlice[];
  topLocations: LocationCount[];
}

const OFFICE = { lat: -27.4705, lng: 153.0056 };
const PRIORITY_ORDER: Priority[] = ["high", "normal", "low", "urgent"];
const PRIORITY_COLOUR: Record<Priority, string> = {
  urgent: "#f7941e",
  high: "#e4453a",
  normal: "#1b7ab8",
  low: "#22a05a",
};
const DUE_WEEKDAY = /^Due (Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/;
const STATUS_COLOUR = {
  scheduled: "#1b7ab8",
  unassigned: "#2aa89a",
  completed: "#94a3b8",
};

export function buildTeamReport(input: {
  jobs: Record<string, Job>;
  allocations: Allocation[];
  period: ReportPeriod;
  weekStart: string;
  monthStart: string;
  today?: Date;
}): TeamReport {
  const today = input.today ?? new Date();
  const dates = periodDates(input.period, input.weekStart, input.monthStart);
  const allocatedInPeriod = new Set(
    input.allocations
      .filter((item) => !dates || dates.has(item.scheduledDate))
      .map((item) => item.jobId)
  );
  const allocatedAnywhere = new Set(input.allocations.map((item) => item.jobId));

  const scoped: Job[] = [];
  for (const job of Object.values(input.jobs)) {
    if (!isFieldJob(job)) continue;
    const inPeriod = allocatedInPeriod.has(job.id);
    const unassigned = !allocatedAnywhere.has(job.id);
    if (input.period === "all" || inPeriod || unassigned) scoped.push(job);
  }

  let scheduledJobs = 0;
  let unassignedJobs = 0;
  let completedJobs = 0;
  let atRiskJobs = 0;
  const priorityCounts: Record<Priority, number> = {
    urgent: 0,
    high: 0,
    normal: 0,
    low: 0,
  };
  const locationCounts = new Map<string, number>();

  for (const job of scoped) {
    const priority = (job.priority ?? "normal") as Priority;
    priorityCounts[priority] += 1;
    locationCounts.set(
      locationRegionOf(job),
      (locationCounts.get(locationRegionOf(job)) ?? 0) + 1
    );

    const complete = job.bookingStatus === "complete";
    const scheduled = allocatedInPeriod.has(job.id) || (input.period === "all" && allocatedAnywhere.has(job.id));
    if (complete) completedJobs += 1;
    else if (scheduled) scheduledJobs += 1;
    else unassignedJobs += 1;

    if (!complete && isAtRisk(job, today, input.weekStart, scheduled)) {
      atRiskJobs += 1;
    }
  }

  const totalJobs = scheduledJobs + unassignedJobs + completedJobs;
  const travel = travelSaved(input.allocations, input.jobs, dates);

  return {
    totalJobs,
    scheduledJobs,
    unassignedJobs,
    completedJobs,
    atRiskJobs,
    travelSavedKm: travel.km,
    travelSavedMinutes: travel.minutes,
    byPriority: slicesFromCounts(
      PRIORITY_ORDER.map((key) => ({
        key,
        label: titleCase(key),
        value: priorityCounts[key],
        color: PRIORITY_COLOUR[key],
      })),
      totalJobs
    ),
    byStatus: slicesFromCounts(
      [
        {
          key: "scheduled",
          label: "Scheduled",
          value: scheduledJobs,
          color: STATUS_COLOUR.scheduled,
        },
        {
          key: "unassigned",
          label: "Unassigned",
          value: unassignedJobs,
          color: STATUS_COLOUR.unassigned,
        },
        {
          key: "completed",
          label: "Completed",
          value: completedJobs,
          color: STATUS_COLOUR.completed,
        },
      ],
      totalJobs
    ),
    topLocations: [...locationCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5),
  };
}

export function locationRegionOf(job: Job): string {
  const raw = (job.suburb || suburbFromAddress(job.address) || "Unknown").trim();
  const key = raw.toLowerCase();
  if (
    [
      "brisbane",
      "brisbane cbd",
      "milton",
      "indooroopilly",
      "oxley",
      "darra",
      "forest lake",
      "springfield",
      "springfield lakes",
      "toowong",
      "taringa",
      "richlands",
      "wacol",
    ].includes(key)
  ) {
    return "Brisbane";
  }
  if (["maroochydore", "nambour", "buderim", "beerwah", "caloundra"].includes(key)) {
    return "Sunshine Coast";
  }
  if (["gold coast", "southport", "biggera waters"].includes(key)) return "Gold Coast";
  if (["logan", "loganlea", "springwood"].includes(key)) return "Logan";
  if (["caboolture", "morayfield", "burpengary", "north lakes", "redcliffe"].includes(key)) {
    return "Moreton Bay";
  }
  if (key === "ipswich" || key === "goodna") return "Ipswich";
  return titleCase(raw);
}

function isAtRisk(
  job: Job,
  today: Date,
  weekStart: string,
  scheduled: boolean
): boolean {
  if (job.priority === "urgent") return true;
  const due = dueStateLabel(job.dueDate, today, weekStart);
  if (due === "Overdue" || due === "Due today") return true;
  if (!scheduled && due != null && DUE_WEEKDAY.test(due)) return true;
  return false;
}

function travelSaved(
  allocations: Allocation[],
  jobs: Record<string, Job>,
  dates: Set<string> | null
): { km: number; minutes: number } {
  const groups = new Map<string, Allocation[]>();
  for (const item of allocations) {
    if (dates && !dates.has(item.scheduledDate)) continue;
    const job = jobs[item.jobId];
    if (!job || !isFieldJob(job) || !pointOf(job.latitude, job.longitude)) continue;
    const key = `${item.consultantId}|${item.scheduledDate}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  let savedKm = 0;
  for (const dayAllocs of groups.values()) {
    const ordered = [...dayAllocs]
      .sort(
        (a, b) =>
          (a.order ?? 0) - (b.order ?? 0) ||
          (a.startTime ?? "").localeCompare(b.startTime ?? "")
      )
      .map((item) => jobs[item.jobId])
      .filter((job): job is Job => Boolean(job && pointOf(job.latitude, job.longitude)));
    if (ordered.length === 0) continue;
    const routed = routeKm(ordered);
    const naive = ordered.reduce((sum, job) => sum + roundTripKm(job), 0);
    savedKm += Math.max(0, naive - routed);
  }

  const minutes = Math.round((savedKm / AVG_SEQ_URBAN_KMH) * 60);
  return { km: Math.round(savedKm), minutes };
}

function routeKm(jobs: Job[]): number {
  let km = 0;
  let previous = OFFICE;
  for (const job of jobs) {
    const point = pointOf(job.latitude, job.longitude);
    if (!point) continue;
    km += haversineDistanceKm(previous, point);
    previous = point;
  }
  km += haversineDistanceKm(previous, OFFICE);
  return km;
}

function roundTripKm(job: Job): number {
  const point = pointOf(job.latitude, job.longitude);
  if (!point) return 0;
  return haversineDistanceKm(OFFICE, point) * 2;
}

function periodDates(
  period: ReportPeriod,
  weekStart: string,
  monthStart: string
): Set<string> | null {
  if (period === "all") return null;
  if (period === "week") {
    return new Set(weekDays(weekStart).map(isoDate));
  }
  return new Set(monthWorkingIsoDates(monthStart));
}

function slicesFromCounts(
  items: Array<{ key: string; label: string; value: number; color: string }>,
  total: number
): ReportSlice[] {
  const denom = total > 0 ? total : 1;
  return items.map((item) => ({
    ...item,
    percent: Math.round((item.value / denom) * 100),
  }));
}

function suburbFromAddress(address: string): string | undefined {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
