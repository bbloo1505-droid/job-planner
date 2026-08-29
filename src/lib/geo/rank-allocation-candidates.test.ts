import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { geocodeAddress, haversineDistanceKm, pointOf } from "@/lib/geo";
import {
  allocationWindowDays,
  rankAllocationCandidates,
} from "@/lib/geo/rank-allocation-candidates";
import { separateOverlappingPoints } from "@/lib/geo/schematic-map";
import { createTeamDemo } from "@/lib/team/dummy-data";
import { isoDate, weekDays } from "@/lib/team/week";

const WEEK = weekDays("2026-08-31").map(isoDate);

describe("local synthetic geocoding", () => {
  it("resolves demo suburbs without a network lookup", () => {
    for (const suburb of [
      "Brisbane",
      "Indooroopilly",
      "Ipswich",
      "Springfield",
      "Logan",
      "Gold Coast",
      "Caboolture",
      "Morayfield",
      "North Lakes",
      "Redcliffe",
      "Nambour",
      "Maroochydore",
      "Buderim",
      "Gympie",
      "Toowoomba",
      "Rockhampton",
      "Bundaberg",
    ]) {
      const result = geocodeAddress(`12 Example St, ${suburb}`);
      assert.equal(result?.suburb, suburb);
    }
  });
});

describe("rankAllocationCandidates", () => {
  it("ranks Taylor / Thursday first for unassigned Nambour", () => {
    const demo = createTeamDemo();
    const nambour = demo.jobs["tj-120"];
    assert.equal(nambour.suburb, "Nambour");
    assert.equal(nambour.priority, "high");
    assert.equal(nambour.dueDate, "2026-09-04");
    assert.equal(nambour.earliestDate, "2026-09-02");
    assert.deepEqual(allocationWindowDays(nambour, WEEK), [
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
    ]);

    const ranked = rankAllocationCandidates({
      job: nambour,
      consultants: demo.consultants,
      jobs: demo.jobs,
      allocations: demo.allocations,
      workingDays: WEEK,
    });

    assert.ok(ranked.length > 0);
    assert.equal(ranked[0].consultantId, "c-taylor");
    assert.equal(ranked[0].date, "2026-09-03");
    assert.equal(ranked[0].feasible, true);
    assert.match(ranked[0].existingWork, /Maroochydore|Buderim/);
    assert.ok(ranked[0].candidateScore >= 0);
    assert.ok(ranked[0].distanceKm < 30);
    assert.match(ranked[0].insertionLabel, /Maroochydore|Buderim|before|after|between/);

    const alexThu = ranked.find(
      (item) => item.consultantId === "c-alex" && item.date === "2026-09-03"
    );
    assert.ok(alexThu);
    assert.ok(alexThu.distanceKm > ranked[0].distanceKm);
    assert.ok(alexThu.candidateScore > ranked[0].candidateScore);

    const origin = pointOf(nambour.latitude, nambour.longitude);
    const maroochydore = pointOf(
      demo.jobs["tj-110"].latitude,
      demo.jobs["tj-110"].longitude
    );
    assert.ok(origin && maroochydore);
    assert.ok(haversineDistanceKm(origin, maroochydore) < 30);
  });

  it("ranks Caboolture closer than the Sunshine Coast for Redcliffe", () => {
    const demo = createTeamDemo();
    const redcliffe = demo.jobs["tj-125"];
    assert.equal(redcliffe.suburb, "Redcliffe");

    const ranked = rankAllocationCandidates({
      job: redcliffe,
      consultants: demo.consultants,
      jobs: demo.jobs,
      allocations: demo.allocations,
      workingDays: WEEK,
    });
    const alex = ranked.find((item) => item.consultantId === "c-alex" && item.date === "2026-09-03");
    const taylor = ranked.find(
      (item) => item.consultantId === "c-taylor" && item.date === "2026-09-03"
    );
    assert.ok(alex);
    assert.ok(taylor);
    assert.ok(alex.distanceKm < taylor.distanceKm);
    assert.ok(alex.candidateScore < taylor.candidateScore);
    assert.ok(ranked.findIndex((item) => item === alex) < ranked.findIndex((item) => item === taylor));
  });

  it("separates overlapping projected markers without changing identity", () => {
    const spaced = separateOverlappingPoints(
      [
        { id: "a", x: 100, y: 100 },
        { id: "b", x: 100, y: 100 },
      ],
      24
    );
    const dist = Math.hypot(spaced[0].x - spaced[1].x, spaced[0].y - spaced[1].y);
    assert.ok(dist >= 23.5);
    assert.equal(new Set(spaced.map((item) => item.id)).size, 2);
  });

  it("uses Thursday dummy placements for the geographic demo", () => {
    const demo = createTeamDemo();
    const thursday = demo.allocations.filter((item) => item.scheduledDate === "2026-09-03");
    const byConsultant = Object.fromEntries(
      thursday.map((item) => [
        item.consultantId,
        demo.jobs[item.jobId]?.suburb,
      ])
    );
    const taylor = thursday
      .filter((item) => item.consultantId === "c-taylor")
      .map((item) => demo.jobs[item.jobId]?.suburb)
      .sort();
    const alex = thursday
      .filter((item) => item.consultantId === "c-alex")
      .map((item) => demo.jobs[item.jobId]?.suburb)
      .sort();
    assert.deepEqual(taylor, ["Buderim", "Maroochydore"]);
    assert.deepEqual(alex, ["Caboolture", "Morayfield"]);
    assert.equal(byConsultant["c-jordan"], "Toowoomba");
    assert.equal(byConsultant["c-casey"], "Gold Coast");
  });
});
