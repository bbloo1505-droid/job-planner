import type { Allocation, Consultant, Job, Priority, WorkCategory } from "@/lib/types";
import { geocodeAddress } from "@/lib/geo";

const OFFICE = "Prensa Milton (demo)";

export const MONTH_EXTRA_CONSULTANTS: Consultant[] = [
  {
    id: "c-harper",
    name: "Harper Cole",
    initials: "HC",
    team: "SEQ Field",
    baseOffice: OFFICE,
    displayColour: "#16a34a",
    active: true,
  },
  {
    id: "c-drew",
    name: "Drew Patel",
    initials: "DP",
    team: "SEQ Field",
    baseOffice: OFFICE,
    displayColour: "#7c3aed",
    active: true,
  },
  {
    id: "c-quinn",
    name: "Quinn Fraser",
    initials: "QF",
    team: "SEQ Field",
    baseOffice: OFFICE,
    displayColour: "#0ea5a4",
    active: true,
  },
  {
    id: "c-avery",
    name: "Avery Nguyen",
    initials: "AN",
    team: "SEQ Field",
    baseOffice: OFFICE,
    displayColour: "#ea7a1c",
    active: true,
  },
  {
    id: "c-blake",
    name: "Blake Foster",
    initials: "BF",
    team: "SEQ Field",
    baseOffice: OFFICE,
    displayColour: "#2563eb",
    active: true,
  },
  {
    id: "c-cameron",
    name: "Cameron Shaw",
    initials: "CS",
    team: "SEQ Field",
    baseOffice: OFFICE,
    displayColour: "#4f46e5",
    active: true,
  },
  {
    id: "c-eden",
    name: "Eden Brooks",
    initials: "EB",
    team: "SEQ Field",
    baseOffice: OFFICE,
    displayColour: "#15803d",
    active: true,
  },
];

type Seed = {
  n: number;
  suburb: string;
  title: string;
  consultant: string;
  date: string;
  time?: string;
  order?: number;
  minutes?: number;
  category?: WorkCategory;
  priority?: Priority;
  dueDate?: string;
};

/** Extra August 2026 work. Does not replace the existing demo week of 31 Aug – 4 Sep. */
const SEEDS: Seed[] = [
  { n: 201, suburb: "Toowoomba", title: "Site Inspection", consultant: "c-jordan", date: "2026-08-03", time: "08:00", category: "confirmed_work" },
  { n: 202, suburb: "Toowoomba", title: "Sampling", consultant: "c-jordan", date: "2026-08-04", time: "09:00", category: "confirmed_work" },
  { n: 203, suburb: "Caboolture", title: "ACM Survey", consultant: "c-alex", date: "2026-08-05", time: "08:00", category: "confirmed_work" },
  { n: 204, suburb: "Morayfield", title: "Sampling", consultant: "c-alex", date: "2026-08-06", time: "09:00", category: "proposed_work" },
  { n: 205, suburb: "Nambour", title: "ACM Survey", consultant: "c-taylor", date: "2026-08-12", time: "08:00", category: "confirmed_work" },
  { n: 206, suburb: "Maroochydore", title: "Sampling", consultant: "c-taylor", date: "2026-08-13", time: "08:00", category: "confirmed_work" },
  { n: 207, suburb: "Buderim", title: "ACM Survey", consultant: "c-taylor", date: "2026-08-14", time: "10:00", category: "confirmed_work" },
  { n: 208, suburb: "Toowoomba", title: "ACM Survey", consultant: "c-jordan", date: "2026-08-17", time: "08:00", category: "confirmed_work" },
  { n: 209, suburb: "North Lakes", title: "Air Monitoring", consultant: "c-alex", date: "2026-08-20", time: "08:00", category: "confirmed_work" },
  { n: 210, suburb: "Gold Coast", title: "Hazmat Survey", consultant: "c-casey", date: "2026-08-24", time: "08:00", category: "confirmed_work" },
  { n: 211, suburb: "Southport", title: "Site Inspection", consultant: "c-casey", date: "2026-08-25", time: "09:30", category: "proposed_work" },
  { n: 212, suburb: "Gold Coast", title: "Sampling", consultant: "c-casey", date: "2026-08-26", time: "08:00", category: "confirmed_work" },

  { n: 213, suburb: "Ipswich", title: "ACM Survey", consultant: "c-alex", date: "2026-08-03", time: "13:00", category: "proposed_work" },
  { n: 214, suburb: "Redcliffe", title: "Reinspection", consultant: "c-alex", date: "2026-08-11", time: "10:00", category: "confirmed_work" },
  { n: 215, suburb: "Logan", title: "Reporting", consultant: "c-alex", date: "2026-08-21", time: "09:00", minutes: 180, category: "reporting" },
  { n: 216, suburb: "Milton", title: "Team meeting", consultant: "c-alex", date: "2026-08-28", time: "08:30", minutes: 60, category: "meeting" },

  { n: 217, suburb: "Ipswich", title: "Site Inspection", consultant: "c-jordan", date: "2026-08-07", time: "08:00", category: "proposed_work" },
  { n: 218, suburb: "Toowoomba", title: "Reporting", consultant: "c-jordan", date: "2026-08-18", time: "09:00", minutes: 150, category: "reporting" },
  { n: 219, suburb: "Springfield", title: "ACM Survey", consultant: "c-jordan", date: "2026-08-21", time: "08:00", category: "confirmed_work" },
  { n: 220, suburb: "Milton", title: "Not available", consultant: "c-jordan", date: "2026-08-27", time: "08:00", minutes: 480, category: "not_available" },

  { n: 221, suburb: "Nambour", title: "Site Inspection", consultant: "c-taylor", date: "2026-08-07", time: "09:00", category: "proposed_work" },
  { n: 222, suburb: "Milton", title: "Reporting", consultant: "c-taylor", date: "2026-08-21", time: "09:00", minutes: 180, category: "reporting" },
  { n: 223, suburb: "Gympie", title: "Reinspection", consultant: "c-taylor", date: "2026-08-25", time: "08:00", category: "confirmed_work" },
  { n: 224, suburb: "Milton", title: "Laboratory analysis", consultant: "c-taylor", date: "2026-08-28", time: "09:00", minutes: 180, category: "laboratory" },

  { n: 225, suburb: "Logan", title: "ACM Survey", consultant: "c-casey", date: "2026-08-04", time: "08:00", category: "confirmed_work" },
  { n: 226, suburb: "Springfield", title: "Sampling", consultant: "c-casey", date: "2026-08-10", time: "09:00", category: "proposed_work" },
  { n: 227, suburb: "Milton", title: "Secondary consultant", consultant: "c-casey", date: "2026-08-14", time: "11:00", category: "secondary_consultant" },
  { n: 228, suburb: "Gold Coast", title: "Reporting", consultant: "c-casey", date: "2026-08-28", time: "09:00", minutes: 150, category: "reporting" },

  { n: 229, suburb: "Milton", title: "Team meeting", consultant: "c-sam", date: "2026-08-03", time: "08:30", minutes: 60, category: "meeting" },
  { n: 230, suburb: "Indooroopilly", title: "ACM Survey", consultant: "c-sam", date: "2026-08-06", time: "09:00", category: "confirmed_work" },
  { n: 231, suburb: "Oxley", title: "Sampling", consultant: "c-sam", date: "2026-08-11", time: "08:00", category: "proposed_work" },
  { n: 232, suburb: "Milton", title: "Not available", consultant: "c-sam", date: "2026-08-18", time: "08:00", minutes: 480, category: "not_available" },
  { n: 233, suburb: "Forest Lake", title: "Reinspection", consultant: "c-sam", date: "2026-08-20", time: "10:00", category: "confirmed_work" },
  { n: 234, suburb: "Milton", title: "Laboratory analysis", consultant: "c-sam", date: "2026-08-25", time: "09:00", minutes: 180, category: "laboratory" },

  { n: 235, suburb: "Ipswich", title: "ACM Survey", consultant: "c-morgan", date: "2026-08-06", time: "08:00", category: "confirmed_work" },
  { n: 236, suburb: "Forest Lake", title: "Sampling", consultant: "c-morgan", date: "2026-08-10", time: "09:30", category: "proposed_work" },
  { n: 237, suburb: "Milton", title: "Reporting", consultant: "c-morgan", date: "2026-08-13", time: "09:00", minutes: 180, category: "reporting" },
  { n: 238, suburb: "Springfield", title: "Site Inspection", consultant: "c-morgan", date: "2026-08-19", time: "08:00", category: "confirmed_work" },
  { n: 239, suburb: "Goodna", title: "ACM Survey", consultant: "c-morgan", date: "2026-08-24", time: "10:00", category: "proposed_work" },

  { n: 240, suburb: "Milton", title: "Laboratory analysis", consultant: "c-riley", date: "2026-08-05", time: "09:00", minutes: 180, category: "laboratory" },
  { n: 241, suburb: "Logan", title: "Sampling", consultant: "c-riley", date: "2026-08-11", time: "08:00", category: "confirmed_work" },
  { n: 242, suburb: "Redcliffe", title: "ACM Survey", consultant: "c-riley", date: "2026-08-17", time: "09:00", category: "proposed_work" },
  { n: 243, suburb: "Logan", title: "Reinspection", consultant: "c-riley", date: "2026-08-27", time: "08:00", category: "confirmed_work" },
  { n: 244, suburb: "Milton", title: "Team meeting", consultant: "c-riley", date: "2026-08-28", time: "08:30", minutes: 60, category: "meeting" },

  { n: 245, suburb: "Brisbane CBD", title: "ACM Survey", consultant: "c-jamie", date: "2026-08-04", time: "09:00", category: "confirmed_work" },
  { n: 246, suburb: "Toowong", title: "Sampling", consultant: "c-jamie", date: "2026-08-07", time: "08:00", category: "proposed_work" },
  { n: 247, suburb: "Oxley", title: "Site Inspection", consultant: "c-jamie", date: "2026-08-14", time: "10:00", category: "confirmed_work" },
  { n: 248, suburb: "Milton", title: "Reporting", consultant: "c-jamie", date: "2026-08-19", time: "09:00", minutes: 150, category: "reporting" },
  { n: 249, suburb: "Oxley", title: "Reinspection", consultant: "c-jamie", date: "2026-08-28", time: "08:00", category: "confirmed_work" },

  { n: 250, suburb: "Springfield", title: "ACM Survey", consultant: "c-harper", date: "2026-08-03", time: "08:00", category: "confirmed_work" },
  { n: 251, suburb: "Springfield", title: "Sampling", consultant: "c-harper", date: "2026-08-04", time: "10:00", category: "proposed_work" },
  { n: 252, suburb: "Forest Lake", title: "Site Inspection", consultant: "c-harper", date: "2026-08-12", time: "09:00", category: "confirmed_work" },
  { n: 253, suburb: "Ipswich", title: "ACM Survey", consultant: "c-harper", date: "2026-08-19", time: "08:00", category: "confirmed_work" },
  { n: 254, suburb: "Milton", title: "Reporting", consultant: "c-harper", date: "2026-08-26", time: "09:00", minutes: 180, category: "reporting" },

  { n: 255, suburb: "Ipswich", title: "Hazmat Survey", consultant: "c-drew", date: "2026-08-05", time: "08:00", minutes: 120, category: "confirmed_work" },
  { n: 256, suburb: "Goodna", title: "Sampling", consultant: "c-drew", date: "2026-08-06", time: "11:00", category: "proposed_work" },
  { n: 257, suburb: "Ipswich", title: "Reinspection", consultant: "c-drew", date: "2026-08-13", time: "08:00", category: "confirmed_work" },
  { n: 258, suburb: "Milton", title: "Not available", consultant: "c-drew", date: "2026-08-20", time: "08:00", minutes: 480, category: "not_available" },
  { n: 259, suburb: "Springfield", title: "ACM Survey", consultant: "c-drew", date: "2026-08-27", time: "09:00", category: "proposed_work" },

  { n: 260, suburb: "Redcliffe", title: "ACM Survey", consultant: "c-quinn", date: "2026-08-04", time: "08:00", category: "confirmed_work" },
  { n: 261, suburb: "North Lakes", title: "Sampling", consultant: "c-quinn", date: "2026-08-05", time: "11:00", category: "confirmed_work" },
  { n: 262, suburb: "Caboolture", title: "Site Inspection", consultant: "c-quinn", date: "2026-08-14", time: "08:00", category: "proposed_work" },
  { n: 263, suburb: "North Lakes", title: "Air Monitoring", consultant: "c-quinn", date: "2026-08-21", time: "09:00", category: "confirmed_work" },
  { n: 264, suburb: "Milton", title: "Team meeting", consultant: "c-quinn", date: "2026-08-28", time: "08:30", minutes: 60, category: "meeting" },

  { n: 265, suburb: "Logan", title: "ACM Survey", consultant: "c-avery", date: "2026-08-06", time: "08:00", category: "confirmed_work" },
  { n: 266, suburb: "Logan", title: "Sampling", consultant: "c-avery", date: "2026-08-07", time: "10:30", category: "proposed_work" },
  { n: 267, suburb: "Logan", title: "Site Inspection", consultant: "c-avery", date: "2026-08-17", time: "08:00", category: "confirmed_work" },
  { n: 268, suburb: "Logan", title: "Reporting", consultant: "c-avery", date: "2026-08-24", time: "09:00", minutes: 150, category: "reporting" },
  { n: 269, suburb: "Springfield", title: "Reinspection", consultant: "c-avery", date: "2026-08-31", time: "08:00", category: "confirmed_work" },

  { n: 270, suburb: "Southport", title: "ACM Survey", consultant: "c-blake", date: "2026-08-10", time: "08:00", category: "confirmed_work" },
  { n: 271, suburb: "Gold Coast", title: "Secondary consultant", consultant: "c-blake", date: "2026-08-24", time: "09:00", category: "secondary_consultant" },
  { n: 272, suburb: "Southport", title: "Sampling", consultant: "c-blake", date: "2026-08-25", time: "13:00", category: "proposed_work" },
  { n: 273, suburb: "Gold Coast", title: "Site Inspection", consultant: "c-blake", date: "2026-08-26", time: "10:00", category: "confirmed_work" },
  { n: 274, suburb: "Milton", title: "Laboratory analysis", consultant: "c-blake", date: "2026-08-31", time: "09:00", minutes: 180, category: "laboratory" },

  { n: 275, suburb: "Milton", title: "Laboratory analysis", consultant: "c-cameron", date: "2026-08-03", time: "09:00", minutes: 180, category: "laboratory" },
  { n: 276, suburb: "Milton", title: "Reporting", consultant: "c-cameron", date: "2026-08-04", time: "09:00", minutes: 180, category: "reporting" },
  { n: 277, suburb: "Indooroopilly", title: "ACM Survey", consultant: "c-cameron", date: "2026-08-12", time: "08:00", category: "confirmed_work" },
  { n: 278, suburb: "Milton", title: "Reporting", consultant: "c-cameron", date: "2026-08-18", time: "09:00", minutes: 180, category: "reporting" },
  { n: 279, suburb: "Toowong", title: "Sampling", consultant: "c-cameron", date: "2026-08-25", time: "10:00", category: "proposed_work" },

  { n: 280, suburb: "Burpengary", title: "ACM Survey", consultant: "c-eden", date: "2026-08-05", time: "08:00", category: "confirmed_work" },
  { n: 281, suburb: "Morayfield", title: "Site Inspection", consultant: "c-eden", date: "2026-08-13", time: "09:00", category: "proposed_work" },
  { n: 282, suburb: "Caboolture", title: "Sampling", consultant: "c-eden", date: "2026-08-19", time: "08:00", category: "confirmed_work" },
  { n: 283, suburb: "Redcliffe", title: "Reinspection", consultant: "c-eden", date: "2026-08-26", time: "10:00", category: "confirmed_work" },
  { n: 284, suburb: "Milton", title: "Not available", consultant: "c-eden", date: "2026-08-31", time: "08:00", minutes: 480, category: "not_available" },
  { n: 285, suburb: "Gold Coast", title: "Hazmat Survey", consultant: "c-casey", date: "2026-08-27", time: "08:00", minutes: 120, category: "management_locked" },
];

function addressFor(suburb: string): string {
  if (suburb === "Milton") return "Prensa Milton (demo)";
  return `12 Example St, ${suburb}`;
}

export function createMonthDemoExtras(): {
  consultants: Consultant[];
  jobs: Record<string, Job>;
  allocations: Allocation[];
} {
  const jobs: Record<string, Job> = {};
  const allocations: Allocation[] = [];
  for (const seed of SEEDS) {
    const id = `tj-${seed.n}`;
    const geo = geocodeAddress(addressFor(seed.suburb));
    jobs[id] = {
      id,
      address: geo?.address ?? addressFor(seed.suburb),
      suburb: geo?.suburb ?? seed.suburb,
      latitude: geo?.lat,
      longitude: geo?.lng,
      estimatedMinutes: seed.minutes ?? 90,
      constraint: seed.time ? { type: "fixed", time: seed.time } : { type: "flexible" },
      bookingStatus: "uncontacted",
      priority: seed.priority ?? "normal",
      dueDate: seed.dueDate,
      jobNumber: `PR-TEST-${seed.n}`,
      client: "Sample Client A",
      title: seed.title,
      workCategory: seed.category ?? "confirmed_work",
    };
    allocations.push({
      id: `al-${seed.n}`,
      jobId: id,
      consultantId: seed.consultant,
      scheduledDate: seed.date,
      startTime: seed.time,
      order: seed.order ?? 0,
    });
  }
  return {
    consultants: MONTH_EXTRA_CONSULTANTS.map((item) => ({ ...item })),
    jobs,
    allocations,
  };
}
