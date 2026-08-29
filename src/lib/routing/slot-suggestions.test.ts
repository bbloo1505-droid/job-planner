import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSlotSuggestions } from "@/lib/routing/slot-suggestions";
import { isRounded } from "@/lib/testing/assert-route";
import {
  getValidationScenario,
  materialiseScenario,
} from "@/lib/testing/validation-scenarios";
import type { Job } from "@/lib/types";

describe("slot suggestions", () => {
  const scenario = getValidationScenario("mid-day-addition")!;
  const loaded = materialiseScenario(scenario);
  const routeJobs = loaded.plan.stops
    .map((stop) => loaded.jobs[stop.jobId])
    .filter((job): job is Job => Boolean(job));
  const unbooked = loaded.plan.unbookedPool[0];

  it("returns rounded times and ranks the lowest feasible impact first", () => {
    const suggestions = getSlotSuggestions({
      job: unbooked,
      routeJobs,
      settings: loaded.plan.settings,
      existingStops: loaded.plan.stops,
    });
    assert.ok(suggestions.length > 0);
    for (const suggestion of suggestions) {
      assert.equal(
        isRounded(suggestion.appointmentTime, loaded.plan.settings.roundToMinutes),
        true
      );
      assert.equal(suggestion.fitsWorkingHours, true);
      assert.equal(suggestion.hasConflict, false);
      assert.equal(Number.isFinite(suggestion.routeImpactMinutes), true);
    }
    const impacts = suggestions.map((item) => item.routeImpactMinutes);
    assert.deepEqual(impacts, [...impacts].sort((a, b) => a - b));
  });

  it("excludes insertions that exceed the working day", () => {
    const tight = {
      ...loaded.plan.settings,
      workingHoursEnd: "09:00",
    };
    const suggestions = getSlotSuggestions({
      job: unbooked,
      routeJobs,
      settings: tight,
      existingStops: loaded.plan.stops,
    });
    assert.equal(suggestions.every((item) => item.fitsWorkingHours), true);
  });

  it("does not suggest a slot that would break a fixed appointment", () => {
    const anchored = routeJobs.map((job, index) =>
      index === 1
        ? { ...job, constraint: { type: "fixed" as const, time: "10:00" } }
        : job
    );
    const resultStops = loaded.plan.stops.map((stop, index) =>
      index === 1 ? { ...stop, suggestedArrival: "10:00" } : stop
    );
    const suggestions = getSlotSuggestions({
      job: unbooked,
      routeJobs: anchored,
      settings: loaded.plan.settings,
      existingStops: resultStops,
    });
    for (const suggestion of suggestions) {
      assert.equal(suggestion.hasConflict, false);
    }
  });
});
