import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  clearClientRouteCacheForTests,
  fetchRouteFromBrowser,
  setRouteFetcherForTests,
} from "@/lib/routing/client";
import type { RoadRoute } from "@/lib/routing/provider";

afterEach(() => {
  setRouteFetcherForTests(null);
  clearClientRouteCacheForTests();
});

const SAMPLE: RoadRoute = {
  geometry: {
    type: "LineString",
    coordinates: [
      [153.0, -27.47],
      [153.01, -27.49],
    ],
  },
  totalDistanceMeters: 4000,
  totalDurationSeconds: 360,
  legs: [{ distanceMeters: 4000, durationSeconds: 360 }],
};

describe("browser route client cache", () => {
  it("H. does not refetch an identical ordered sequence", async () => {
    let calls = 0;
    setRouteFetcherForTests(async () => {
      calls += 1;
      return SAMPLE;
    });
    const coords: Array<[number, number]> = [
      [153.0, -27.47],
      [153.01, -27.49],
    ];
    await fetchRouteFromBrowser(coords);
    await fetchRouteFromBrowser(coords);
    assert.equal(calls, 1);
  });
});
