import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@/lib/dummy-data";
import { optimiseDay } from "@/lib/routing/optimise-day";
import { timeToMinutes } from "@/lib/routing/round-time";
import {
  assertHealthyResult,
  isRounded,
} from "@/lib/testing/assert-route";
import {
  getValidationScenario,
  materialiseScenario,
} from "@/lib/testing/validation-scenarios";
import type { Job } from "@/lib/types";

function jobsOf(id: string): { jobs: Job[]; settings: typeof DEFAULT_SETTINGS } {
  const scenario = getValidationScenario(id);
  assert.ok(scenario);
  const loaded = materialiseScenario(scenario);
  const jobs = scenario.pendingJobIds
    .map((jobId) => loaded.jobs[jobId])
    .filter((job): job is Job => Boolean(job));
  return { jobs, settings: scenario.settings };
}

describe("optimiseDay invariants", () => {
  it("does not crash on an empty day", () => {
    const result = optimiseDay({ jobs: [], settings: DEFAULT_SETTINGS });
    assert.equal(result.stops.length, 0);
    assertHealthyResult(result);
  });

  it("does not crash on a one-stop day", () => {
    const { jobs, settings } = jobsOf("simple-corridor");
    const result = optimiseDay({ jobs: jobs.slice(0, 1), settings });
    assert.equal(result.stops.length, 1);
    assertHealthyResult(result);
  });

  it("does not crash on duplicate addresses", () => {
    const { jobs, settings } = jobsOf("simple-corridor");
    const clone: Job = { ...jobs[0], id: "dup-address" };
    const result = optimiseDay({ jobs: [jobs[0], clone], settings });
    assert.equal(result.stops.length, 2);
    assertHealthyResult(result);
  });

  it("rounds flexible appointment times to the configured interval", () => {
    const { jobs, settings } = jobsOf("simple-corridor");
    const result = optimiseDay({ jobs, settings });
    assertHealthyResult(result);
    for (const stop of result.stops) {
      assert.ok(stop.suggestedArrival);
      assert.equal(isRounded(stop.suggestedArrival, settings.roundToMinutes), true);
    }
  });

  it("keeps a fixed appointment at the locked time", () => {
    const { jobs, settings } = jobsOf("fixed-anchor");
    const oxley = jobs.find((job) => job.id === "c-oxley");
    assert.ok(oxley);
    const result = optimiseDay({ jobs, settings });
    const stop = result.stops.find((item) => item.jobId === "c-oxley");
    assert.equal(stop?.suggestedArrival, "10:00");
  });

  it("never schedules an after-constraint before the specified time", () => {
    const { jobs, settings } = jobsOf("after-time");
    const result = optimiseDay({ jobs, settings });
    const stop = result.stops.find((item) => item.jobId === "c-springfield");
    assert.ok(stop?.suggestedArrival);
    assert.ok(timeToMinutes(stop.suggestedArrival) >= timeToMinutes("13:00"));
  });

  it("flags a before-constraint that cannot be met instead of hiding it", () => {
    const { jobs, settings } = jobsOf("simple-corridor");
    const early: Job = {
      ...jobs[jobs.length - 1],
      id: "too-early",
      constraint: { type: "before", time: "07:45" },
    };
    const result = optimiseDay({
      jobs: [jobs[0], early],
      settings,
    });
    const stop = result.stops.find((item) => item.jobId === "too-early");
    if (stop?.suggestedArrival && timeToMinutes(stop.suggestedArrival) >= timeToMinutes("07:45")) {
      assert.ok(stop.conflict);
      assert.equal(stop.conflict.code, "missed_before");
    }
  });

  it("keeps a between-constraint inside its window when feasible", () => {
    const { jobs, settings } = jobsOf("simple-corridor");
    const windowed: Job = {
      ...jobs[0],
      constraint: { type: "between", start: "09:00", end: "11:00" },
    };
    const rest = jobs.slice(1);
    const result = optimiseDay({ jobs: [windowed, ...rest], settings });
    const stop = result.stops.find((item) => item.jobId === windowed.id);
    assert.ok(stop?.suggestedArrival);
    const minutes = timeToMinutes(stop.suggestedArrival);
    if (!stop.conflict) {
      assert.ok(minutes >= timeToMinutes("09:00"));
      assert.ok(minutes <= timeToMinutes("11:00"));
    } else {
      assert.equal(stop.conflict.code, "outside_window");
    }
  });

  it("uses each job sampling duration instead of the global visit default", () => {
    const { jobs, settings } = jobsOf("simple-corridor");
    const first = { ...jobs[0], samplingDurationMinutes: 45, estimatedMinutes: 45 };
    const rest = jobs.slice(1).map((job) => ({
      ...job,
      samplingDurationMinutes: 10,
      estimatedMinutes: 10,
    }));
    const result = optimiseDay({
      jobs: [first, ...rest],
      settings: { ...settings, visitDurationMinutes: 20 },
      preserveOrder: true,
    });
    const firstStop = result.stops[0];
    assert.ok(firstStop?.suggestedArrival && firstStop.suggestedDeparture);
    assert.equal(
      timeToMinutes(firstStop.suggestedDeparture) - timeToMinutes(firstStop.suggestedArrival),
      45
    );
  });

  it("does not store a zero-minute leg when a stop has no coordinates", () => {
    const { jobs, settings } = jobsOf("simple-corridor");
    const unresolved: Job = {
      ...jobs[0],
      id: "unresolved-bay",
      address: "cork st deception bay",
      suburb: undefined,
      latitude: undefined,
      longitude: undefined,
    };
    const result = optimiseDay({
      jobs: [jobs[0], unresolved],
      settings,
      preserveOrder: true,
    });
    const stop = result.stops.find((item) => item.jobId === "unresolved-bay");
    assert.ok(stop);
    assert.equal(stop.travelMinutesFromPrevious, undefined);
  });

  it("flags an overloaded day rather than dropping jobs", () => {
    const { jobs, settings } = jobsOf("overloaded-day");
    const result = optimiseDay({ jobs, settings });
    assert.equal(result.stops.length, jobs.length);
    assert.equal(result.exceedsWorkingDay, true);
    assert.ok(result.conflicts.length > 0);
  });
});
