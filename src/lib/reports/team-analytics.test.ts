import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { geocodeAddress, haversineDistanceKm, pointOf } from "@/lib/geo";
import {
  buildTeamReport,
  locationRegionOf,
} from "@/lib/reports/team-analytics";
import { AVG_SEQ_URBAN_KMH } from "@/lib/routing/travel";
import { createTeamDemo } from "@/lib/team/dummy-data";
import type { Allocation, Job } from "@/lib/types";

const OFFICE = { lat: -27.4705, lng: 153.0056 };
const TODAY = new Date(2026, 7, 29);

function fieldJob(id: string, address: string, extras: Partial<Job> = {}): Job {
  const geo = geocodeAddress(address);
  return {
    id,
    address: geo?.address ?? address,
    suburb: geo?.suburb,
    estimatedMinutes: 90,
    constraint: { type: "flexible" },
    bookingStatus: "uncontacted",
    workCategory: "confirmed_work",
    priority: "normal",
    latitude: geo?.lat,
    longitude: geo?.lng,
    ...extras,
  };
}

describe("locationRegionOf", () => {
  it("rolls SEQ suburbs into regions used on the dashboard", () => {
    assert.equal(locationRegionOf(fieldJob("a", "9 Trial St, Brisbane CBD")), "Brisbane");
    assert.equal(locationRegionOf(fieldJob("b", "11 Example Pde, Maroochydore")), "Sunshine Coast");
    assert.equal(locationRegionOf(fieldJob("c", "40 Mock Ave, Gold Coast")), "Gold Coast");
    assert.equal(locationRegionOf(fieldJob("d", "15 Demo Rd, Logan")), "Logan");
    assert.equal(locationRegionOf(fieldJob("e", "5 Mock St, Toowoomba")), "Toowoomba");
  });
});

describe("buildTeamReport", () => {
  it("counts field jobs, skips meetings, and flags at-risk work", () => {
    const jobs: Record<string, Job> = {
      a: fieldJob("a", "9 Trial St, Brisbane CBD", {
        priority: "high",
        dueDate: "2026-09-02",
      }),
      b: fieldJob("b", "15 Demo Rd, Logan", {
        priority: "urgent",
        dueDate: "2026-08-20",
      }),
      c: fieldJob("c", "11 Example Pde, Maroochydore", { dueDate: "2026-09-03" }),
      meet: fieldJob("meet", "Prensa Milton (demo)", { workCategory: "meeting" }),
    };
    const allocations: Allocation[] = [
      {
        id: "al-a",
        jobId: "a",
        consultantId: "c-alex",
        scheduledDate: "2026-08-31",
        startTime: "08:00",
        order: 0,
      },
    ];

    const report = buildTeamReport({
      jobs,
      allocations,
      period: "week",
      weekStart: "2026-08-31",
      monthStart: "2026-08-01",
      today: TODAY,
    });

    assert.equal(report.totalJobs, 3);
    assert.equal(report.scheduledJobs, 1);
    assert.equal(report.unassignedJobs, 2);
    assert.equal(report.completedJobs, 0);
    assert.equal(report.atRiskJobs, 2);
    assert.equal(report.byPriority.find((slice) => slice.key === "high")?.value, 1);
    assert.equal(report.byPriority.find((slice) => slice.key === "urgent")?.value, 1);
    assert.deepEqual(
      report.topLocations.map((item) => item.name),
      ["Brisbane", "Logan", "Sunshine Coast"]
    );
  });

  it("estimates travel saved as naive round-trips minus a chained day", () => {
    const gold = fieldJob("gold", "40 Mock Ave, Gold Coast");
    const south = fieldJob("south", "Southport");
    const goldPoint = pointOf(gold.latitude, gold.longitude);
    const southPoint = pointOf(south.latitude, south.longitude);
    assert.ok(goldPoint);
    assert.ok(southPoint);

    const naive =
      haversineDistanceKm(OFFICE, goldPoint) * 2 + haversineDistanceKm(OFFICE, southPoint) * 2;
    const routed =
      haversineDistanceKm(OFFICE, goldPoint) +
      haversineDistanceKm(goldPoint, southPoint) +
      haversineDistanceKm(southPoint, OFFICE);
    const expectedKm = Math.round(Math.max(0, naive - routed));

    const report = buildTeamReport({
      jobs: { gold, south },
      allocations: [
        {
          id: "al-1",
          jobId: "gold",
          consultantId: "c-alex",
          scheduledDate: "2026-08-31",
          startTime: "08:00",
          order: 0,
        },
        {
          id: "al-2",
          jobId: "south",
          consultantId: "c-alex",
          scheduledDate: "2026-08-31",
          startTime: "11:00",
          order: 1,
        },
      ],
      period: "week",
      weekStart: "2026-08-31",
      monthStart: "2026-08-01",
      today: TODAY,
    });

    assert.equal(report.travelSavedKm, expectedKm);
    assert.ok(report.travelSavedKm > 0);
    assert.equal(
      report.travelSavedMinutes,
      Math.round((expectedKm / AVG_SEQ_URBAN_KMH) * 60)
    );
  });

  it("summarises the demo week without including August-only allocations", () => {
    const demo = createTeamDemo();
    const week = buildTeamReport({
      jobs: demo.jobs,
      allocations: demo.allocations,
      period: "week",
      weekStart: "2026-08-31",
      monthStart: "2026-08-01",
      today: TODAY,
    });
    const month = buildTeamReport({
      jobs: demo.jobs,
      allocations: demo.allocations,
      period: "month",
      weekStart: "2026-08-31",
      monthStart: "2026-08-01",
      today: TODAY,
    });
    const all = buildTeamReport({
      jobs: demo.jobs,
      allocations: demo.allocations,
      period: "all",
      weekStart: "2026-08-31",
      monthStart: "2026-08-01",
      today: TODAY,
    });

    assert.equal(week.scheduledJobs + week.unassignedJobs + week.completedJobs, week.totalJobs);
    assert.equal(week.scheduledJobs, 21);
    assert.equal(week.unassignedJobs, 8);
    assert.equal(week.completedJobs, 0);
    assert.equal(week.atRiskJobs, 3);
    assert.ok(week.travelSavedKm > 0);
    assert.ok(month.scheduledJobs > week.scheduledJobs);
    assert.ok(all.totalJobs >= month.totalJobs);
    assert.ok(week.topLocations.some((item) => item.name === "Brisbane"));
    assert.equal(week.byStatus.find((slice) => slice.key === "scheduled")?.percent, 72);
  });
});
