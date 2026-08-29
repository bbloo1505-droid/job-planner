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

  it("D. uses road travel and sampling to suggest rounded appointment times", () => {
    const { jobs, settings } = jobsOf("simple-corridor");
    const two = jobs.slice(0, 2).map((job, index) => ({
      ...job,
      samplingDurationMinutes: index === 0 ? 30 : 20,
      estimatedMinutes: index === 0 ? 30 : 20,
    }));
    const result = optimiseDay({
      jobs: two,
      settings: {
        ...settings,
        roundToMinutes: 15,
        startTime: "07:30",
        travelBufferMinutes: 0,
      },
      preserveOrder: true,
      travelLegs: [
        { minutes: 27, meters: 16400 },
        { minutes: 18, meters: 9000 },
        { minutes: 22, meters: 11000 },
      ],
    });
    assert.equal(result.stops[0].travelMinutesFromPrevious, 27);
    assert.equal(result.stops[0].suggestedArrival, "08:00");
    assert.equal(result.stops[0].suggestedDeparture, "08:30");
    assert.equal(result.stops[1].travelMinutesFromPrevious, 18);
    assert.equal(result.stops[1].suggestedArrival, "09:00");
    assert.equal(result.returnTravelMinutes, 22);
  });

  it("adds access buffer then rounds appointment times up", () => {
    const { jobs, settings } = jobsOf("simple-corridor");
    const two = jobs.slice(0, 2).map((job) => ({
      ...job,
      samplingDurationMinutes: 20,
      estimatedMinutes: 20,
      constraint: { type: "flexible" as const },
    }));
    const result = optimiseDay({
      jobs: two,
      settings: {
        ...settings,
        startTime: "07:30",
        roundToMinutes: 15,
        travelBufferMinutes: 5,
        visitDurationMinutes: 20,
      },
      preserveOrder: true,
      travelLegs: [
        { minutes: 17, meters: 9000 },
        { minutes: 17, meters: 9000 },
        { minutes: 17, meters: 9000 },
      ],
    });
    assertHealthyResult(result);
    assert.equal(result.stops[0].travelMinutesFromPrevious, 17);
    assert.equal(result.stops[0].accessBufferMinutes, 5);
    assert.equal(result.stops[0].earliestArrival, "07:52");
    assert.equal(result.stops[0].suggestedArrival, "08:00");
    assert.equal(result.stops[0].suggestedDeparture, "08:20");
    assert.equal(result.stops[1].travelMinutesFromPrevious, 17);
    assert.equal(result.stops[1].accessBufferMinutes, 5);
    assert.equal(result.stops[1].earliestArrival, "08:42");
    assert.equal(result.stops[1].suggestedArrival, "08:45");
    assert.equal(result.totalAccessMinutes, 15);
  });

  it("never rounds a suggested booking down", () => {
    const { jobs, settings } = jobsOf("simple-corridor");
    const one = [{
      ...jobs[0],
      samplingDurationMinutes: 20,
      estimatedMinutes: 20,
      constraint: { type: "flexible" as const },
    }];
    const result = optimiseDay({
      jobs: one,
      settings: {
        ...settings,
        startTime: "08:00",
        roundToMinutes: 15,
        travelBufferMinutes: 5,
      },
      preserveOrder: true,
      travelLegs: [
        { minutes: 40, meters: 20000 },
        { minutes: 10, meters: 4000 },
      ],
    });
    assert.equal(result.stops[0].earliestArrival, "08:45");
    assert.equal(result.stops[0].suggestedArrival, "08:45");
  });

  it("keeps a fixed booking and reports waiting instead of compressing", () => {
    const { jobs, settings } = jobsOf("simple-corridor");
    const anchored: Job = {
      ...jobs[0],
      samplingDurationMinutes: 20,
      estimatedMinutes: 20,
      constraint: { type: "fixed", time: "10:00" },
    };
    const result = optimiseDay({
      jobs: [anchored],
      settings: {
        ...settings,
        startTime: "09:00",
        roundToMinutes: 15,
        travelBufferMinutes: 5,
      },
      preserveOrder: true,
      travelLegs: [
        { minutes: 30, meters: 15000 },
        { minutes: 12, meters: 5000 },
      ],
    });
    assert.equal(result.stops[0].earliestArrival, "09:35");
    assert.equal(result.stops[0].suggestedArrival, "10:00");
    assert.equal(result.stops[0].waitingMinutes, 25);
    assert.equal(result.stops[0].suggestedDeparture, "10:20");
  });
});
