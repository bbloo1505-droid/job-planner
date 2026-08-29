import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getDrivingRoute, setRoutingProviderForTests } from "@/lib/routing/directions";
import { serverRoadRouteCache } from "@/lib/routing/route-cache";
import type { RoadRoute, RoutingProvider } from "@/lib/routing/provider";

afterEach(() => {
  setRoutingProviderForTests(null);
  serverRoadRouteCache.clear();
});

const SAMPLE: RoadRoute = {
  geometry: {
    type: "LineString",
    coordinates: [
      [153.0, -27.47],
      [153.01, -27.48],
      [153.02, -27.5],
    ],
  },
  totalDistanceMeters: 12000,
  totalDurationSeconds: 900,
  legs: [
    { distanceMeters: 5000, durationSeconds: 400 },
    { distanceMeters: 7000, durationSeconds: 500 },
  ],
};

describe("getDrivingRoute cache", () => {
  it("H. caches identical coordinate sequences", async () => {
    let calls = 0;
    const provider: RoutingProvider = {
      getDrivingRoute: async () => {
        calls += 1;
        return SAMPLE;
      },
    };
    setRoutingProviderForTests(provider);
    const coords: Array<[number, number]> = [
      [153.0, -27.47],
      [153.02, -27.5],
    ];
    const first = await getDrivingRoute(coords);
    const second = await getDrivingRoute(coords);
    assert.equal(calls, 1);
    assert.equal(first.cached, false);
    assert.equal(second.cached, true);
    assert.equal(second.route.totalDurationSeconds, 900);
  });
});
