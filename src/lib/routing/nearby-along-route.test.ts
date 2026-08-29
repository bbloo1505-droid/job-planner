import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNearbyAlongRoute } from "@/lib/routing/nearby-along-route";
import {
  getValidationScenario,
  materialiseScenario,
} from "@/lib/testing/validation-scenarios";
import type { Job } from "@/lib/types";

describe("nearby opportunities", () => {
  it("omits jobs already on the route even if they leak into the pool", () => {
    const scenario = getValidationScenario("mid-day-addition")!;
    const loaded = materialiseScenario(scenario);
    const routeJobs = loaded.plan.stops
      .map((stop) => loaded.jobs[stop.jobId])
      .filter((job): job is Job => Boolean(job));
    const leaked = [...loaded.plan.unbookedPool, routeJobs[0]];
    const matches = getNearbyAlongRoute({
      unbooked: leaked,
      routeJobs,
      settings: loaded.plan.settings,
      existingStops: loaded.plan.stops,
    });
    assert.equal(
      matches.some((match) => match.job.id === routeJobs[0].id),
      false
    );
  });

  it("sorts by detour ascending and keeps finite detours", () => {
    const scenario = getValidationScenario("mid-day-addition")!;
    const loaded = materialiseScenario(scenario);
    const routeJobs = loaded.plan.stops
      .map((stop) => loaded.jobs[stop.jobId])
      .filter((job): job is Job => Boolean(job));
    const matches = getNearbyAlongRoute({
      unbooked: loaded.plan.unbookedPool,
      routeJobs,
      settings: loaded.plan.settings,
      existingStops: loaded.plan.stops,
    });
    const detours = matches.map((match) => match.detourMinutes);
    const known = detours.filter((item): item is number => item != null);
    assert.deepEqual(
      known,
      [...known].sort((a, b) => a - b)
    );
    assert.equal(known.every(Number.isFinite), true);
  });

  it("does not invent a zero-minute detour for an unresolved opportunity", () => {
    const scenario = getValidationScenario("mid-day-addition")!;
    const loaded = materialiseScenario(scenario);
    const routeJobs = loaded.plan.stops
      .map((stop) => loaded.jobs[stop.jobId])
      .filter((job): job is Job => Boolean(job));
    const unresolved: Job = {
      id: "unresolved-bay",
      address: "cork st deception bay",
      suburb: undefined,
      estimatedMinutes: 20,
      samplingDurationMinutes: 20,
      constraint: { type: "flexible" },
      bookingStatus: "uncontacted",
    };
    const matches = getNearbyAlongRoute({
      unbooked: [...loaded.plan.unbookedPool, unresolved],
      routeJobs,
      settings: loaded.plan.settings,
      existingStops: loaded.plan.stops,
    });
    const match = matches.find((item) => item.job.id === unresolved.id);
    assert.ok(match);
    assert.equal(match.detourMinutes, null);
  });
});
