import { geocodeAddress } from "@/lib/geo";
import type {
  Allocation,
  Consultant,
  Job,
  Priority,
  WorkCategory,
} from "@/lib/types";

const OFFICE = "Prensa Milton (demo)";

export const TEAM_CONSULTANTS: Consultant[] = [
  {
    id: "c-alex",
    name: "Alex Morgan",
    initials: "AM",
    team: "SEQ Field",
    baseOffice: OFFICE,
    displayColour: "#1b7ab8",
    active: true,
  },
  {
    id: "c-jordan",
    name: "Jordan Lee",
    initials: "JL",
    team: "SEQ Field",
    baseOffice: OFFICE,
    displayColour: "#3d5a80",
    active: true,
  },
  {
    id: "c-taylor",
    name: "Taylor Reid",
    initials: "TR",
    team: "SEQ Field",
    baseOffice: OFFICE,
    displayColour: "#4f6f7a",
    active: true,
  },
  {
    id: "c-casey",
    name: "Casey Martin",
    initials: "CM",
    team: "SEQ Field",
    baseOffice: OFFICE,
    displayColour: "#3f6b52",
    active: true,
  },
  {
    id: "c-sam",
    name: "Sam Parker",
    initials: "SP",
    team: "SEQ Field",
    baseOffice: OFFICE,
    displayColour: "#6a5f52",
    active: true,
  },
  {
    id: "c-morgan",
    name: "Morgan Ellis",
    initials: "ME",
    team: "SEQ Field",
    baseOffice: OFFICE,
    displayColour: "#5a6b78",
    active: true,
  },
  {
    id: "c-riley",
    name: "Riley Chen",
    initials: "RC",
    team: "SEQ Field",
    baseOffice: OFFICE,
    displayColour: "#6b6840",
    active: true,
  },
  {
    id: "c-jamie",
    name: "Jamie Ward",
    initials: "JW",
    team: "SEQ Field",
    baseOffice: OFFICE,
    displayColour: "#4d5d6b",
    active: true,
  },
];

type SeedJob = {
  id: string;
  n: number;
  address: string;
  title: string;
  minutes?: number;
  priority?: Priority;
  dueDate?: string;
  earliestDate?: string;
  notes?: string;
  workCategory?: WorkCategory;
};

function seedJob(input: SeedJob): Job {
  const geo = geocodeAddress(input.address);
  return {
    id: input.id,
    address: geo?.address ?? input.address,
    suburb: geo?.suburb,
    latitude: geo?.lat,
    longitude: geo?.lng,
    estimatedMinutes: input.minutes ?? 90,
    constraint: { type: "flexible" },
    bookingStatus: "uncontacted",
    priority: input.priority ?? "normal",
    dueDate: input.dueDate,
    earliestDate: input.earliestDate,
    notes: input.notes,
    jobNumber: `PR-TEST-${input.n}`,
    client: "Sample Client A",
    title: input.title,
    workCategory: input.workCategory ?? "confirmed_work",
  };
}

function alloc(
  id: string,
  jobId: string,
  consultantId: string,
  scheduledDate: string,
  startTime?: string,
  order = 0
): Allocation {
  return { id, jobId, consultantId, scheduledDate, startTime, order };
}

const JOBS: SeedJob[] = [
  { id: "tj-100", n: 100, address: "18 Sample Rd, Ipswich", title: "ACM Survey", minutes: 90, dueDate: "2026-09-04", workCategory: "confirmed_work" },
  { id: "tj-101", n: 101, address: "22 Example St, Springfield", title: "Sampling", minutes: 60, dueDate: "2026-09-04", workCategory: "proposed_work" },
  { id: "tj-102", n: 102, address: "9 Trial St, Brisbane CBD", title: "Site Inspection", minutes: 75, dueDate: "2026-09-02", workCategory: "confirmed_work" },
  { id: "tj-103", n: 103, address: "40 Mock Ave, Gold Coast", title: "Hazmat Survey", minutes: 120, dueDate: "2026-09-04", workCategory: "management_locked" },
  { id: "tj-104", n: 104, address: "15 Demo Rd, Logan", title: "Reinspection", minutes: 45, priority: "high", dueDate: "2026-09-01", workCategory: "reporting" },
  { id: "tj-105", n: 105, address: "Prensa Milton (demo)", title: "Team meeting", minutes: 60, workCategory: "meeting" },
  { id: "tj-106", n: 106, address: "12 Example St, Caboolture", title: "ACM Survey", minutes: 90, dueDate: "2026-09-03", workCategory: "confirmed_work" },
  { id: "tj-107", n: 107, address: "8 Trial Ave, Morayfield", title: "Sampling", minutes: 60, workCategory: "proposed_work" },
  { id: "tj-108", n: 108, address: "5 Mock St, Toowoomba", title: "Site Inspection", minutes: 90, dueDate: "2026-09-02", workCategory: "confirmed_work" },
  { id: "tj-109", n: 109, address: "Prensa Milton (demo)", title: "Laboratory analysis", minutes: 180, workCategory: "laboratory" },
  { id: "tj-110", n: 110, address: "11 Example Pde, Maroochydore", title: "Sampling", minutes: 60, dueDate: "2026-09-04", workCategory: "secondary_consultant" },
  { id: "tj-111", n: 111, address: "18 Sample Ct, Springfield", title: "Reinspection", minutes: 45, workCategory: "confirmed_work" },
  { id: "tj-112", n: 112, address: "12 Example St, Indooroopilly", title: "ACM Survey", minutes: 90, workCategory: "confirmed_work" },
  { id: "tj-113", n: 113, address: "6 Demo Rd, Ipswich", title: "Air Monitoring", minutes: 60, priority: "high", dueDate: "2026-09-03", workCategory: "reporting" },
  { id: "tj-114", n: 114, address: "15 Demo Rd, Logan", title: "Sampling", minutes: 60, workCategory: "confirmed_work" },
  { id: "tj-115", n: 115, address: "12 Example St, Caboolture", title: "Reinspection", minutes: 45, workCategory: "proposed_work" },
  { id: "tj-116", n: 116, address: "40 Mock Ave, Gold Coast", title: "Site Inspection", minutes: 75, workCategory: "confirmed_work" },
  { id: "tj-117", n: 117, address: "9 Trial St, Brisbane CBD", title: "ACM Survey", minutes: 90, workCategory: "proposed_work" },
  { id: "tj-118", n: 118, address: "61 Example Rd, Forest Lake", title: "Sampling", minutes: 60, dueDate: "2026-09-04", workCategory: "confirmed_work" },
  { id: "tj-119", n: 119, address: "14 Demo St, Beerwah", title: "ACM Survey", minutes: 90, dueDate: "2026-09-07", workCategory: "confirmed_work" },
  { id: "tj-120", n: 120, address: "3 Mock St, Nambour", title: "ACM Survey", minutes: 90, priority: "high", earliestDate: "2026-09-02", dueDate: "2026-09-04", workCategory: "proposed_work" },
  { id: "tj-121", n: 121, address: "16 Sample St, Gympie", title: "Reinspection", minutes: 45, dueDate: "2026-09-11", workCategory: "proposed_work" },
  { id: "tj-122", n: 122, address: "15 Demo Rd, Logan", title: "Sampling", minutes: 60, priority: "urgent", dueDate: "2026-08-29", workCategory: "proposed_work" },
  { id: "tj-123", n: 123, address: "5 Mock St, Toowoomba", title: "Sampling", minutes: 60, priority: "high", workCategory: "proposed_work" },
  { id: "tj-124", n: 124, address: "11 Example Pde, Maroochydore", title: "Hazmat Survey", minutes: 120, dueDate: "2026-09-08", workCategory: "proposed_work" },
  { id: "tj-125", n: 125, address: "7 Sample Pde, Redcliffe", title: "Site Inspection", minutes: 75, priority: "low", dueDate: "2026-09-11", workCategory: "proposed_work" },
  { id: "tj-126", n: 126, address: "21 Lake Rd, North Lakes", title: "Air Monitoring", minutes: 60, dueDate: "2026-09-03", workCategory: "proposed_work" },
  { id: "tj-127", n: 127, address: "84 Sample Rd, Oxley", title: "Reinspection", minutes: 45, workCategory: "proposed_work" },
  { id: "tj-128", n: 128, address: "Prensa Milton (demo)", title: "Not available", minutes: 480, workCategory: "not_available" },
  { id: "tj-129", n: 129, address: "4 Trial Rd, Buderim", title: "ACM Survey", minutes: 90, dueDate: "2026-09-04", workCategory: "confirmed_work" },
  { id: "tj-130", n: 130, address: "9 Trial St, Brisbane CBD", title: "Site Inspection", minutes: 75, dueDate: "2026-09-02", workCategory: "confirmed_work" },
];

export function createTeamDemo(): {
  consultants: Consultant[];
  jobs: Record<string, Job>;
  allocations: Allocation[];
} {
  const jobs: Record<string, Job> = {};
  for (const item of JOBS) {
    jobs[item.id] = seedJob(item);
  }

  const allocations: Allocation[] = [
    alloc("al-100", "tj-100", "c-alex", "2026-08-31", "08:00", 0),
    alloc("al-101", "tj-101", "c-alex", "2026-08-31", "13:00", 1),
    alloc("al-102", "tj-102", "c-jordan", "2026-08-31", "09:00", 0),
    alloc("al-103", "tj-103", "c-taylor", "2026-08-31", "08:00", 0),
    alloc("al-104", "tj-104", "c-casey", "2026-08-31", "10:00", 0),
    alloc("al-105", "tj-105", "c-sam", "2026-08-31", "08:30", 0),
    alloc("al-130", "tj-130", "c-alex", "2026-09-01", "09:00", 0),
    alloc("al-109", "tj-109", "c-riley", "2026-09-01", "09:00", 0),
    alloc("al-119", "tj-119", "c-morgan", "2026-09-01", "08:00", 0),
    alloc("al-111", "tj-111", "c-casey", "2026-09-02", "09:00", 0),
    alloc("al-112", "tj-112", "c-sam", "2026-09-02", "10:00", 0),
    alloc("al-113", "tj-113", "c-morgan", "2026-09-02", "14:00", 0),
    alloc("al-106", "tj-106", "c-alex", "2026-09-03", "08:00", 0),
    alloc("al-107", "tj-107", "c-alex", "2026-09-03", "11:00", 1),
    alloc("al-110", "tj-110", "c-taylor", "2026-09-03", "08:00", 0),
    alloc("al-129", "tj-129", "c-taylor", "2026-09-03", "11:00", 1),
    alloc("al-108", "tj-108", "c-jordan", "2026-09-03", "07:30", 0),
    alloc("al-116", "tj-116", "c-casey", "2026-09-03", "08:00", 0),
    alloc("al-128", "tj-128", "c-sam", "2026-09-03", "08:00", 0),
    alloc("al-114", "tj-114", "c-alex", "2026-09-04", "08:00", 0),
    alloc("al-115", "tj-115", "c-riley", "2026-09-04", "09:30", 0),
    alloc("al-117", "tj-117", "c-jamie", "2026-09-04", "09:00", 0),
    alloc("al-118", "tj-118", "c-casey", "2026-09-04", "11:00", 0),
  ];

  return {
    consultants: TEAM_CONSULTANTS.map((item) => ({ ...item })),
    jobs,
    allocations,
  };
}
