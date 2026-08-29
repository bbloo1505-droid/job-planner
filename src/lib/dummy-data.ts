import { geocodeAddress } from "@/lib/geo";
import type {
  DayPlan,
  DayPlanSettings,
  Job,
  Priority,
} from "@/lib/types";

export const DEFAULT_SETTINGS: DayPlanSettings = {
  date: "2026-09-01",
  startLocation: "Prensa Milton (demo)",
  startLat: -27.4705,
  startLng: 153.0056,
  startTime: "07:30",
  finishLocation: "Prensa Milton (demo)",
  finishLat: -27.4705,
  finishLng: 153.0056,
  workingHoursEnd: "16:00",
  visitDurationMinutes: 20,
  travelBufferMinutes: 10,
  roundToMinutes: 15,
};

function jobFromAddress(
  id: string,
  address: string,
  extras: Partial<Job> = {}
): Job {
  const geo = geocodeAddress(address);
  return {
    id,
    address: geo?.address ?? address,
    suburb: geo?.suburb,
    latitude: geo?.lat,
    longitude: geo?.lng,
    estimatedMinutes: DEFAULT_SETTINGS.visitDurationMinutes,
    constraint: { type: "flexible" },
    bookingStatus: "uncontacted",
    priority: extras.priority ?? "normal",
    ...extras,
  };
}

export const DEMO_PENDING_JOBS: Job[] = [
  jobFromAddress("job-001", "12 Example St, Indooroopilly", {
    jobNumber: "PR-TEST-001",
    client: "Sample Client A",
  }),
  jobFromAddress("job-002", "84 Sample Rd, Oxley", {
    jobNumber: "PR-TEST-002",
    client: "Sample Client A",
  }),
  jobFromAddress("job-003", "15 Test Ave, Darra", {
    jobNumber: "PR-TEST-003",
    client: "Sample Client A",
  }),
  jobFromAddress("job-004", "29 House St, Inala", {
    jobNumber: "PR-TEST-004",
    client: "Demo Project B",
  }),
  jobFromAddress("job-005", "61 Example Rd, Forest Lake", {
    jobNumber: "PR-TEST-005",
    client: "Demo Project B",
  }),
  jobFromAddress("job-006", "18 Sample Ct, Springfield", {
    jobNumber: "PR-TEST-006",
    client: "Demo Project B",
  }),
];

export const DEMO_UNBOOKED_JOBS: Job[] = [
  jobFromAddress("job-101", "8 Railway Pde, Darra", {
    jobNumber: "PR-TEST-101",
    client: "Sample Client A",
    priority: "high" as Priority,
    dueDate: "2026-09-04",
  }),
  jobFromAddress("job-102", "22 Example St, Inala", {
    jobNumber: "PR-TEST-102",
    client: "Sample Client A",
    dueDate: "2026-09-03",
  }),
  jobFromAddress("job-103", "15 Lake Rd, Forest Lake", {
    jobNumber: "PR-TEST-103",
    client: "Demo Project B",
    dueDate: "2026-09-05",
  }),
  jobFromAddress("job-104", "90 Sample St, Caboolture", {
    jobNumber: "PR-TEST-104",
    client: "Demo Project B",
    priority: "low" as Priority,
    dueDate: "2026-09-11",
  }),
];

export function allDemoJobs(): Job[] {
  return [...DEMO_PENDING_JOBS, ...DEMO_UNBOOKED_JOBS];
}

export function createDemoPlan(): {
  plan: DayPlan;
  jobs: Record<string, Job>;
  pendingJobIds: string[];
} {
  const jobs: Record<string, Job> = {};
  for (const job of allDemoJobs()) {
    jobs[job.id] = job;
  }

  return {
    jobs,
    pendingJobIds: DEMO_PENDING_JOBS.map((job) => job.id),
    plan: {
      id: "plan-demo-tuesday",
      settings: { ...DEFAULT_SETTINGS },
      stops: [],
      unbookedPool: DEMO_UNBOOKED_JOBS.map((job) => ({ ...job })),
    },
  };
}