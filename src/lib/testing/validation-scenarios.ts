/**
 * Synthetic Stage 1 validation fixtures.
 *
 * Development-only loader (ignored in production builds):
 *   http://localhost:3000/?scenario=simple-corridor
 *   http://localhost:3000/?scenario=fixed-anchor
 *   http://localhost:3000/?scenario=after-time
 *   http://localhost:3000/?scenario=multiple-constraints
 *   http://localhost:3000/?scenario=inefficient-outlier
 *   http://localhost:3000/?scenario=overloaded-day
 *   http://localhost:3000/?scenario=mid-day-addition
 *   http://localhost:3000/?scenario=alternate-finish
 *   http://localhost:3000/?scenario=regional-distances
 *   http://localhost:3000/?scenario=booking-failure
 *
 * In the browser console (dev only): window.__prensaDayRoute.diagnose()
 */
import { DEFAULT_SETTINGS } from "@/lib/dummy-data";
import { geocodeAddress } from "@/lib/geo";
import { optimiseDay } from "@/lib/routing/optimise-day";
import type {
  AppointmentConstraint,
  DayPlan,
  DayPlanSettings,
  Job,
  Priority,
} from "@/lib/types";

export type ValidationScenarioId =
  | "simple-corridor"
  | "fixed-anchor"
  | "after-time"
  | "multiple-constraints"
  | "inefficient-outlier"
  | "overloaded-day"
  | "mid-day-addition"
  | "alternate-finish"
  | "regional-distances"
  | "booking-failure";

export interface ValidationScenario {
  id: ValidationScenarioId;
  name: string;
  description: string;
  settings: DayPlanSettings;
  jobs: Job[];
  pendingJobIds: string[];
  unbookedIds: string[];
  /** When true, the store hydrates an already-optimised route. */
  startOptimised: boolean;
}

function job(
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
    estimatedMinutes: extras.estimatedMinutes ?? DEFAULT_SETTINGS.visitDurationMinutes,
    constraint: extras.constraint ?? { type: "flexible" },
    bookingStatus: extras.bookingStatus ?? "uncontacted",
    priority: extras.priority ?? "normal",
    jobNumber: extras.jobNumber,
    client: extras.client ?? "Sample Client A",
    dueDate: extras.dueDate,
    notes: extras.notes,
  };
}

function settings(partial: Partial<DayPlanSettings> = {}): DayPlanSettings {
  return { ...DEFAULT_SETTINGS, ...partial };
}

const UNBOOKED_NEARBY: Job[] = [
  job("pool-darra", "8 Railway Pde, Darra", {
    jobNumber: "PR-TEST-101",
    priority: "high" as Priority,
    dueDate: "2026-09-04",
  }),
  job("pool-inala", "22 Example St, Inala", {
    jobNumber: "PR-TEST-102",
    dueDate: "2026-09-03",
  }),
  job("pool-forest", "15 Lake Rd, Forest Lake", {
    jobNumber: "PR-TEST-103",
    client: "Demo Project B",
    dueDate: "2026-09-05",
  }),
  job("pool-caboolture", "90 Sample St, Caboolture", {
    jobNumber: "PR-TEST-104",
    client: "Demo Project B",
    priority: "low" as Priority,
    dueDate: "2026-09-11",
  }),
];

const CORRIDOR: Job[] = [
  job("c-indooroopilly", "12 Example St, Indooroopilly", { jobNumber: "PR-TEST-001" }),
  job("c-oxley", "84 Sample Rd, Oxley", { jobNumber: "PR-TEST-002" }),
  job("c-darra", "15 Test Ave, Darra", { jobNumber: "PR-TEST-003" }),
  job("c-inala", "29 House St, Inala", { jobNumber: "PR-TEST-004", client: "Demo Project B" }),
  job("c-forest", "61 Example Rd, Forest Lake", { jobNumber: "PR-TEST-005", client: "Demo Project B" }),
  job("c-springfield", "18 Sample Ct, Springfield", { jobNumber: "PR-TEST-006", client: "Demo Project B" }),
];

function withPool(routeJobs: Job[], pool = UNBOOKED_NEARBY): Job[] {
  return [...routeJobs, ...pool];
}

export const VALIDATION_SCENARIOS: ValidationScenario[] = [
  {
    id: "simple-corridor",
    name: "Simple corridor",
    description: "Six geographically sensible flexible stops along the western Brisbane corridor.",
    settings: settings(),
    jobs: withPool(CORRIDOR),
    pendingJobIds: CORRIDOR.map((item) => item.id),
    unbookedIds: UNBOOKED_NEARBY.map((item) => item.id),
    startOptimised: false,
  },
  {
    id: "fixed-anchor",
    name: "Fixed anchor",
    description: "Corridor day with Oxley locked to a 10:00 AM appointment.",
    settings: settings(),
    jobs: withPool(
      CORRIDOR.map((item) =>
        item.id === "c-oxley"
          ? { ...item, constraint: { type: "fixed", time: "10:00" } satisfies AppointmentConstraint }
          : item
      )
    ),
    pendingJobIds: CORRIDOR.map((item) => item.id),
    unbookedIds: UNBOOKED_NEARBY.map((item) => item.id),
    startOptimised: false,
  },
  {
    id: "after-time",
    name: "After-time constraint",
    description: "Springfield is only available after 13:00.",
    settings: settings(),
    jobs: withPool(
      CORRIDOR.map((item) =>
        item.id === "c-springfield"
          ? { ...item, constraint: { type: "after", time: "13:00" } satisfies AppointmentConstraint }
          : item
      )
    ),
    pendingJobIds: CORRIDOR.map((item) => item.id),
    unbookedIds: UNBOOKED_NEARBY.map((item) => item.id),
    startOptimised: false,
  },
  {
    id: "multiple-constraints",
    name: "Multiple constraints",
    description: "One fixed, one after-time, and one before-time job on the same day.",
    settings: settings(),
    jobs: withPool(
      CORRIDOR.map((item) => {
        if (item.id === "c-oxley") {
          return { ...item, constraint: { type: "fixed", time: "10:00" } satisfies AppointmentConstraint };
        }
        if (item.id === "c-springfield") {
          return { ...item, constraint: { type: "after", time: "14:00" } satisfies AppointmentConstraint };
        }
        if (item.id === "c-indooroopilly") {
          return { ...item, constraint: { type: "before", time: "09:00" } satisfies AppointmentConstraint };
        }
        return item;
      })
    ),
    pendingJobIds: CORRIDOR.map((item) => item.id),
    unbookedIds: UNBOOKED_NEARBY.map((item) => item.id),
    startOptimised: false,
  },
  {
    id: "inefficient-outlier",
    name: "Inefficient outlier",
    description: "Five clustered inner-west properties plus a distant Caboolture stop.",
    settings: settings(),
    jobs: withPool([
      job("o-toowong", "9 Trial St, Toowong", { jobNumber: "PR-TEST-201" }),
      job("o-taringa", "4 Mock Ave, Taringa", { jobNumber: "PR-TEST-202" }),
      job("o-indooroopilly", "12 Example St, Indooroopilly", { jobNumber: "PR-TEST-203" }),
      job("o-oxley", "84 Sample Rd, Oxley", { jobNumber: "PR-TEST-204" }),
      job("o-darra", "15 Test Ave, Darra", { jobNumber: "PR-TEST-205" }),
      job("o-caboolture", "90 Sample St, Caboolture", {
        jobNumber: "PR-TEST-206",
        client: "Demo Project B",
        priority: "low",
      }),
    ]),
    pendingJobIds: [
      "o-toowong",
      "o-taringa",
      "o-indooroopilly",
      "o-oxley",
      "o-darra",
      "o-caboolture",
    ],
    unbookedIds: UNBOOKED_NEARBY.map((item) => item.id),
    startOptimised: false,
  },
  {
    id: "overloaded-day",
    name: "Overloaded day",
    description: "More visits than can finish by a 12:00 working-day end. Human stays in control.",
    settings: settings({ workingHoursEnd: "12:00" }),
    jobs: withPool([
      job("ov-1", "12 Example St, Indooroopilly", { jobNumber: "PR-TEST-301" }),
      job("ov-2", "9 Trial St, Toowong", { jobNumber: "PR-TEST-302" }),
      job("ov-3", "4 Mock Ave, Taringa", { jobNumber: "PR-TEST-303" }),
      job("ov-4", "84 Sample Rd, Oxley", { jobNumber: "PR-TEST-304" }),
      job("ov-5", "15 Test Ave, Darra", { jobNumber: "PR-TEST-305" }),
      job("ov-6", "29 House St, Inala", { jobNumber: "PR-TEST-306" }),
      job("ov-7", "61 Example Rd, Forest Lake", { jobNumber: "PR-TEST-307" }),
      job("ov-8", "18 Sample Ct, Springfield", { jobNumber: "PR-TEST-308" }),
      job("ov-9", "11 Sample St, Goodna", { jobNumber: "PR-TEST-309" }),
      job("ov-10", "6 Demo Rd, Ipswich", { jobNumber: "PR-TEST-310" }),
    ]),
    pendingJobIds: ["ov-1", "ov-2", "ov-3", "ov-4", "ov-5", "ov-6", "ov-7", "ov-8", "ov-9", "ov-10"],
    unbookedIds: UNBOOKED_NEARBY.map((item) => item.id),
    startOptimised: false,
  },
  {
    id: "mid-day-addition",
    name: "Mid-day addition",
    description: "An existing four-stop route plus unbooked jobs with mixed detour costs.",
    settings: settings(),
    jobs: [
      job("m-indooroopilly", "12 Example St, Indooroopilly", { jobNumber: "PR-TEST-401" }),
      job("m-oxley", "84 Sample Rd, Oxley", { jobNumber: "PR-TEST-402" }),
      job("m-darra", "15 Test Ave, Darra", { jobNumber: "PR-TEST-403" }),
      job("m-inala", "29 House St, Inala", { jobNumber: "PR-TEST-404" }),
      ...UNBOOKED_NEARBY,
    ],
    pendingJobIds: ["m-indooroopilly", "m-oxley", "m-darra", "m-inala"],
    unbookedIds: UNBOOKED_NEARBY.map((item) => item.id),
    startOptimised: true,
  },
  {
    id: "alternate-finish",
    name: "Alternate finish",
    description: "Start at Milton but finish at the Ipswich depot.",
    settings: settings({
      finishLocation: "Prensa Ipswich (demo)",
      finishLat: -27.6146,
      finishLng: 152.7609,
    }),
    jobs: withPool(CORRIDOR),
    pendingJobIds: CORRIDOR.map((item) => item.id),
    unbookedIds: UNBOOKED_NEARBY.map((item) => item.id),
    startOptimised: false,
  },
  {
    id: "regional-distances",
    name: "Regional distances",
    description: "Synthetic longer-distance Sunshine Coast / north SEQ day.",
    settings: settings({
      visitDurationMinutes: 30,
      travelBufferMinutes: 15,
    }),
    jobs: [
      job("r-burpengary", "20 Sample Rd, Burpengary", { jobNumber: "PR-TEST-501" }),
      job("r-morayfield", "8 Trial Ave, Morayfield", { jobNumber: "PR-TEST-502" }),
      job("r-caboolture", "90 Sample St, Caboolture", { jobNumber: "PR-TEST-503" }),
      job("r-beerwah", "14 Demo St, Beerwah", { jobNumber: "PR-TEST-504", client: "Demo Project B" }),
      job("r-nambour", "3 Mock St, Nambour", { jobNumber: "PR-TEST-505", client: "Demo Project B" }),
      job("r-maroochydore", "11 Example Pde, Maroochydore", {
        jobNumber: "PR-TEST-506",
        client: "Demo Project B",
      }),
      job("r-darra-pool", "8 Railway Pde, Darra", {
        jobNumber: "PR-TEST-507",
        notes: "Unrelated corridor leftover — large detour from this regional day.",
      }),
    ],
    pendingJobIds: [
      "r-burpengary",
      "r-morayfield",
      "r-caboolture",
      "r-beerwah",
      "r-nambour",
      "r-maroochydore",
    ],
    unbookedIds: ["r-darra-pool"],
    startOptimised: false,
  },
  {
    id: "booking-failure",
    name: "Booking failure",
    description:
      "Pre-built corridor route. Darra cannot accept the proposed window and should be moved out of the day.",
    settings: settings(),
    jobs: withPool(
      CORRIDOR.map((item) =>
        item.id === "c-darra"
          ? {
              ...item,
              notes: "Tenant asked to reschedule to another day.",
            }
          : item
      )
    ),
    pendingJobIds: CORRIDOR.map((item) => item.id),
    unbookedIds: UNBOOKED_NEARBY.map((item) => item.id),
    startOptimised: true,
  },
];

export function getValidationScenario(
  id: string
): ValidationScenario | undefined {
  return VALIDATION_SCENARIOS.find((scenario) => scenario.id === id);
}

export function materialiseScenario(scenario: ValidationScenario): {
  jobs: Record<string, Job>;
  pendingJobIds: string[];
  plan: DayPlan;
  hasOptimised: boolean;
} {
  const jobs: Record<string, Job> = {};
  for (const item of scenario.jobs) {
    jobs[item.id] = structuredClone(item);
  }
  const pendingJobs = scenario.pendingJobIds
    .map((id) => jobs[id])
    .filter((item): item is Job => Boolean(item));
  const unbookedPool = scenario.unbookedIds
    .map((id) => jobs[id])
    .filter((item): item is Job => Boolean(item))
    .map((item) => structuredClone(item));

  if (!scenario.startOptimised) {
    return {
      jobs,
      pendingJobIds: [...scenario.pendingJobIds],
      hasOptimised: false,
      plan: {
        id: `plan-${scenario.id}`,
        settings: { ...scenario.settings },
        stops: [],
        unbookedPool,
      },
    };
  }

  const result = optimiseDay({
    jobs: pendingJobs,
    settings: scenario.settings,
    preserveOrder: false,
  });

  return {
    jobs,
    pendingJobIds: [],
    hasOptimised: true,
    plan: {
      id: `plan-${scenario.id}`,
      settings: { ...scenario.settings },
      stops: result.stops,
      unbookedPool,
    },
  };
}
