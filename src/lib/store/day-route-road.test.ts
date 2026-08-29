import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  clearClientRouteCacheForTests,
  setRouteFetcherForTests,
} from "@/lib/routing/client";
import { RoutingTimeoutError, type RoadRoute } from "@/lib/routing/provider";
import {
  flushRoadRouteForTests,
  resetDayRouteStore,
  setRoadRouteDebounceForTests,
  useDayRouteStore,
} from "@/lib/store/day-route-store";

function mockRoadRoute(coordinates: Array<[number, number]>): RoadRoute {
  const coordinatesWithBend: Array<[number, number]> = [];
  coordinates.forEach((pair, index) => {
    if (index > 0) {
      const prev = coordinates[index - 1];
      coordinatesWithBend.push([
        (prev[0] + pair[0]) / 2 + 0.004,
        (prev[1] + pair[1]) / 2,
      ]);
    }
    coordinatesWithBend.push(pair);
  });
  return {
    geometry: { type: "LineString", coordinates: coordinatesWithBend },
    totalDistanceMeters: (coordinates.length - 1) * 5000,
    totalDurationSeconds: 27 * 60 + (coordinates.length - 2) * 18 * 60,
    legs: coordinates.slice(1).map((_, index) => ({
      distanceMeters: 4000 + index * 250,
      durationSeconds: (index === 0 ? 27 : 18) * 60,
    })),
  };
}

afterEach(() => {
  setRouteFetcherForTests(null);
  clearClientRouteCacheForTests();
  setRoadRouteDebounceForTests(null);
  resetDayRouteStore();
});

beforeEach(() => {
  setRoadRouteDebounceForTests(0);
  clearClientRouteCacheForTests();
});

describe("day route road routing", () => {
  it("A/C. applies a successful road route to the timeline", async () => {
    let calls = 0;
    setRouteFetcherForTests(async (coordinates) => {
      calls += 1;
      return mockRoadRoute(coordinates);
    });
    useDayRouteStore.getState().loadScenario("simple-corridor");
    useDayRouteStore.getState().runOptimise();
    await flushRoadRouteForTests();
    const state = useDayRouteStore.getState();
    assert.equal(state.roadRouteStatus, "live");
    assert.ok(state.roadRoute);
    assert.ok(state.roadRoute.geometry.coordinates.length > state.plan.stops.length);
    assert.equal(state.plan.stops[0]?.travelMinutesFromPrevious, 27);
    assert.equal(calls, 1);
    for (const stop of state.plan.stops.slice(1)) {
      assert.equal(stop.travelMinutesFromPrevious, 18);
    }
  });

  it("E. drag reorder requests a new route once after drop", async () => {
    let calls = 0;
    setRouteFetcherForTests(async (coordinates) => {
      calls += 1;
      return mockRoadRoute(coordinates);
    });
    useDayRouteStore.getState().loadScenario("simple-corridor");
    useDayRouteStore.getState().runOptimise();
    await flushRoadRouteForTests();
    assert.equal(calls, 1);
    const before = useDayRouteStore.getState().plan.stops.map((stop) => stop.jobId);
    useDayRouteStore.getState().reorderStop(0, 2);
    await flushRoadRouteForTests();
    const after = useDayRouteStore.getState().plan.stops.map((stop) => stop.jobId);
    assert.notDeepEqual(after, before);
    assert.equal(calls, 2);
    assert.equal(useDayRouteStore.getState().roadRouteStatus, "live");
  });

  it("F. sampling duration changes do not request a new road route", async () => {
    let calls = 0;
    setRouteFetcherForTests(async (coordinates) => {
      calls += 1;
      return mockRoadRoute(coordinates);
    });
    useDayRouteStore.getState().loadScenario("simple-corridor");
    useDayRouteStore.getState().runOptimise();
    await flushRoadRouteForTests();
    assert.equal(calls, 1);
    const jobId = useDayRouteStore.getState().plan.stops[0]?.jobId;
    assert.ok(jobId);
    const arrivalBefore = useDayRouteStore.getState().plan.stops[1]?.suggestedArrival;
    useDayRouteStore.getState().updateSamplingDuration(jobId, 45);
    assert.equal(calls, 1);
    const arrivalAfter = useDayRouteStore.getState().plan.stops[1]?.suggestedArrival;
    assert.ok(arrivalBefore);
    assert.ok(arrivalAfter);
    assert.notEqual(arrivalAfter, arrivalBefore);
    assert.equal(useDayRouteStore.getState().plan.stops[0]?.travelMinutesFromPrevious, 27);
  });

  it("G. provider timeout falls back to the local estimator", async () => {
    setRouteFetcherForTests(async () => {
      throw new RoutingTimeoutError();
    });
    useDayRouteStore.getState().loadScenario("simple-corridor");
    useDayRouteStore.getState().runOptimise();
    await flushRoadRouteForTests();
    const state = useDayRouteStore.getState();
    assert.equal(state.roadRouteStatus, "fallback");
    assert.equal(
      state.roadRouteMessage,
      "Live road routing unavailable — using estimated travel."
    );
    assert.equal(state.roadRoute, null);
    assert.ok((state.plan.stops[0]?.travelMinutesFromPrevious ?? 0) > 0);
  });

  it("access buffer and booking interval retime without a new road request", async () => {
    let calls = 0;
    setRouteFetcherForTests(async (coordinates) => {
      calls += 1;
      return mockRoadRoute(coordinates);
    });
    useDayRouteStore.getState().loadScenario("simple-corridor");
    useDayRouteStore.getState().runOptimise();
    await flushRoadRouteForTests();
    assert.equal(calls, 1);
    const travelBefore = useDayRouteStore.getState().plan.stops[0]?.travelMinutesFromPrevious;
    assert.equal(travelBefore, 27);
    useDayRouteStore.getState().updateSettings({ travelBufferMinutes: 0 });
    assert.equal(calls, 1);
    assert.equal(useDayRouteStore.getState().plan.stops[0]?.suggestedArrival, "08:00");
    assert.equal(useDayRouteStore.getState().plan.stops[0]?.travelMinutesFromPrevious, 27);
    useDayRouteStore.getState().updateSettings({ travelBufferMinutes: 15 });
    assert.equal(calls, 1);
    assert.equal(useDayRouteStore.getState().plan.stops[0]?.suggestedArrival, "08:15");
    useDayRouteStore.getState().updateSettings({ roundToMinutes: 30 });
    assert.equal(calls, 1);
    assert.equal(useDayRouteStore.getState().plan.stops[0]?.suggestedArrival, "08:30");
    assert.equal(useDayRouteStore.getState().needsRecalculate, false);
    assert.equal(useDayRouteStore.getState().plan.stops[0]?.accessBufferMinutes, 15);
  });

  it("H. identical order does not call the routing client again", async () => {
    let calls = 0;
    setRouteFetcherForTests(async (coordinates) => {
      calls += 1;
      return mockRoadRoute(coordinates);
    });
    useDayRouteStore.getState().loadScenario("simple-corridor");
    useDayRouteStore.getState().runOptimise();
    await flushRoadRouteForTests();
    await useDayRouteStore.getState().refreshRoadRoute();
    await useDayRouteStore.getState().refreshRoadRoute();
    assert.equal(calls, 1);
  });
});
