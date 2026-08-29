import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { geocodeAddress } from "@/lib/geo";
import {
  calculateBestInsertion,
  formatAdditionalTravel,
} from "@/lib/geo/insertion-cost";
import { rankAllocationCandidates } from "@/lib/geo/rank-allocation-candidates";
import type { Allocation, Consultant, Job } from "@/lib/types";

const OFFICE = "Prensa Milton (demo)";

function consultant(id: string, name: string): Consultant {
  const parts = name.split(" ");
  return {
    id,
    name,
    initials: `${parts[0][0]}${parts[1]?.[0] ?? ""}`,
    team: "SEQ Field",
    baseOffice: OFFICE,
    displayColour: "#1b7ab8",
    active: true,
  };
}

function job(id: string, address: string, extras: Partial<Job> = {}): Job {
  const geo = geocodeAddress(address);
  const { latitude, longitude, ...rest } = extras;
  return {
    id,
    address: geo?.address ?? address,
    suburb: geo?.suburb,
    estimatedMinutes: 60,
    constraint: { type: "flexible" },
    bookingStatus: "uncontacted",
    workCategory: "confirmed_work",
    ...rest,
    latitude: latitude ?? geo?.lat,
    longitude: longitude ?? geo?.lng,
  };
}

function alloc(
  id: string,
  jobId: string,
  consultantId: string,
  date: string,
  order = 0,
  startTime?: string
): Allocation {
  return { id, jobId, consultantId, scheduledDate: date, order, startTime };
}

const alex = consultant("c-a", "Alex Close");
const blair = consultant("c-b", "Blair Between");

describe("calculateBestInsertion", () => {
  it("ranks an empty day as office → job → office", () => {
    const nambour = job("new", "3 Mock St, Nambour");
    const result = calculateBestInsertion({
      job: nambour,
      consultant: alex,
      date: "2026-09-03",
      allocations: [],
      jobs: { new: nambour },
    });
    assert.equal(result.insertionIndex, 0);
    assert.equal(result.existingTravelMinutes, 0);
    assert.ok(result.additionalTravelMinutes > 0);
    assert.equal(result.additionalTravelMinutes, result.newTravelMinutes);
    assert.equal(result.existingLocations.length, 0);
    assert.equal(result.feasible, true);
  });

  it("chooses before vs after a single existing job", () => {
    const existing = job("east", "40 Mock Ave, Gold Coast");
    const insert = job("near-office", "12 Example St, Indooroopilly");
    const result = calculateBestInsertion({
      job: insert,
      consultant: alex,
      date: "2026-09-03",
      allocations: [alloc("al-1", "east", "c-a", "2026-09-03", 0)],
      jobs: { east: existing, "near-office": insert },
    });
    assert.equal(result.feasible, true);
    assert.equal(result.insertionIndex, 0);
    assert.equal(result.nextJobId, "east");
  });

  it("inserts after the final job when that continues the corridor", () => {
    const first = job("first", "First north", {
      latitude: -27.2,
      longitude: 153.0,
      suburb: "North Lakes",
    });
    const last = job("last", "Last north", {
      latitude: -26.9,
      longitude: 153.0,
      suburb: "Caboolture",
    });
    const beyond = job("beyond", "Just past last", {
      latitude: -26.88,
      longitude: 153.12,
      suburb: "Morayfield",
    });
    const result = calculateBestInsertion({
      job: beyond,
      consultant: alex,
      date: "2026-09-03",
      allocations: [
        alloc("al-1", "first", "c-a", "2026-09-03", 0),
        alloc("al-2", "last", "c-a", "2026-09-03", 1),
      ],
      jobs: { first, last, beyond },
    });
    assert.equal(result.feasible, true);
    assert.equal(result.insertionIndex, 2);
    assert.equal(result.previousJobId, "last");
  });

  it("tests every insertion on a multi-stop day and picks the lowest additional travel", () => {
    const maroochydore = job("mar", "11 Example Pde, Maroochydore", { estimatedMinutes: 45 });
    const buderim = job("bud", "4 Trial Rd, Buderim", { estimatedMinutes: 45 });
    const nambour = job("nam", "3 Mock St, Nambour", { estimatedMinutes: 45 });
    const result = calculateBestInsertion({
      job: nambour,
      consultant: alex,
      date: "2026-09-03",
      allocations: [
        alloc("al-1", "mar", "c-a", "2026-09-03", 0),
        alloc("al-2", "bud", "c-a", "2026-09-03", 1),
      ],
      jobs: { mar: maroochydore, bud: buderim, nam: nambour },
    });
    assert.equal(result.feasible, true);
    assert.ok(result.insertionIndex >= 0);
    assert.ok(result.insertionIndex <= 2);
    assert.ok(result.additionalTravelMinutes < result.newTravelMinutes);
    assert.deepEqual(result.existingLocations, ["Maroochydore", "Buderim"]);
  });

  it("rejects insertion that cannot fit between fixed appointments", () => {
    const first = job("a", "9 Trial St, Brisbane CBD", {
      estimatedMinutes: 120,
      constraint: { type: "fixed", time: "08:00" },
    });
    const second = job("b", "12 Example St, Indooroopilly", {
      estimatedMinutes: 120,
      constraint: { type: "fixed", time: "10:00" },
    });
    const insert = job("c", "12 Example St, Taringa", { estimatedMinutes: 90 });
    const result = calculateBestInsertion({
      job: insert,
      consultant: alex,
      date: "2026-09-03",
      allocations: [
        alloc("al-1", "a", "c-a", "2026-09-03", 0, "08:00"),
        alloc("al-2", "b", "c-a", "2026-09-03", 1, "10:00"),
      ],
      jobs: { a: first, b: second, c: insert },
    });
    assert.equal(result.feasible, false);
    assert.match(result.infeasibleReason ?? "", /Insufficient time|finish after/i);
  });

  it("rejects a job that would finish after the working-day end", () => {
    const remote = job("remote", "1 Sample St, Rockhampton", { estimatedMinutes: 60 });
    const result = calculateBestInsertion({
      job: remote,
      consultant: alex,
      date: "2026-09-03",
      allocations: [],
      jobs: { remote },
    });
    assert.equal(result.feasible, false);
    assert.match(result.infeasibleReason ?? "", /4:00 PM/i);
  });
});

describe("rankAllocationCandidates insertion cost", () => {
  it("prefers on-path insertion over a geographically closer detour", () => {
    const nambour = job("new", "3 Mock St, Nambour", { estimatedMinutes: 30 });
    const closeThenFar = job("close", "11 Example Pde, Maroochydore", { estimatedMinutes: 30 });
    const farSouth = job("south", "40 Mock Ave, Gold Coast", { estimatedMinutes: 30 });
    const southEnd = job("cab", "12 Example St, Caboolture", { estimatedMinutes: 30 });
    const northEnd = job("gym", "16 Sample St, Gympie", { estimatedMinutes: 30 });
    const jobs = {
      new: nambour,
      close: closeThenFar,
      south: farSouth,
      cab: southEnd,
      gym: northEnd,
    };
    const allocations: Allocation[] = [
      alloc("al-a1", "close", "c-a", "2026-09-03", 0),
      alloc("al-a2", "south", "c-a", "2026-09-03", 1),
      alloc("al-b1", "cab", "c-b", "2026-09-03", 0),
      alloc("al-b2", "gym", "c-b", "2026-09-03", 1),
    ];
    const ranked = rankAllocationCandidates({
      job: nambour,
      consultants: [alex, blair],
      jobs,
      allocations,
      workingDays: ["2026-09-03"],
    });
    assert.equal(ranked[0].consultantId, "c-b");
    assert.equal(ranked[0].feasible, true);
    const closer = ranked.find((item) => item.consultantId === "c-a");
    assert.ok(closer);
    assert.ok(closer.distanceKm < ranked[0].distanceKm);
    assert.ok(ranked[0].additionalTravelMinutes < closer.additionalTravelMinutes);
  });

  it("honours a one-day due window", () => {
    const nambour = job("new", "3 Mock St, Nambour", {
      earliestDate: "2026-09-04",
      dueDate: "2026-09-04",
    });
    const ranked = rankAllocationCandidates({
      job: nambour,
      consultants: [alex],
      jobs: { new: nambour },
      allocations: [],
      workingDays: ["2026-09-02", "2026-09-03", "2026-09-04"],
    });
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].date, "2026-09-04");
    assert.equal(ranked[0].feasible, true);
  });

  it("keeps infeasible candidates below feasible ones", () => {
    const packed = job("fixed-a", "9 Trial St, Brisbane CBD", {
      estimatedMinutes: 240,
      constraint: { type: "fixed", time: "08:00" },
    });
    const packed2 = job("fixed-b", "12 Example St, Indooroopilly", {
      estimatedMinutes: 240,
      constraint: { type: "fixed", time: "12:00" },
    });
    const open = job("open", "11 Example Pde, Maroochydore");
    const insert = job("new", "3 Mock St, Nambour", { estimatedMinutes: 90 });
    const ranked = rankAllocationCandidates({
      job: insert,
      consultants: [alex, blair],
      jobs: {
        "fixed-a": packed,
        "fixed-b": packed2,
        open,
        new: insert,
      },
      allocations: [
        alloc("al-1", "fixed-a", "c-a", "2026-09-03", 0, "08:00"),
        alloc("al-2", "fixed-b", "c-a", "2026-09-03", 1, "12:00"),
        alloc("al-3", "open", "c-b", "2026-09-03", 0),
      ],
      workingDays: ["2026-09-03"],
    });
    assert.equal(ranked[0].consultantId, "c-b");
    assert.equal(ranked[0].feasible, true);
    const blocked = ranked.find((item) => item.consultantId === "c-a");
    assert.equal(blocked?.feasible, false);
  });

  it("returns only infeasible options when nobody can absorb the job", () => {
    const a = job("a", "5 Mock St, Toowoomba", {
      estimatedMinutes: 400,
      constraint: { type: "fixed", time: "08:00" },
    });
    const insert = job("new", "40 Mock Ave, Gold Coast", { estimatedMinutes: 180 });
    const ranked = rankAllocationCandidates({
      job: insert,
      consultants: [alex],
      jobs: { a, new: insert },
      allocations: [alloc("al-1", "a", "c-a", "2026-09-03", 0, "08:00")],
      workingDays: ["2026-09-03"],
    });
    assert.ok(ranked.length > 0);
    assert.equal(ranked.every((item) => item.feasible === false), true);
  });

  it("formats additional travel in minutes and hours", () => {
    assert.equal(formatAdditionalTravel(18), "+18 min estimated travel");
    assert.equal(formatAdditionalTravel(72), "+1h 12m estimated travel");
    assert.equal(formatAdditionalTravel(120), "+2h estimated travel");
  });
});
