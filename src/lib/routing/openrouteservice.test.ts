import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { serverRoadRouteCache } from "@/lib/routing/route-cache";
import {
  OPENROUTESERVICE_DIRECTIONS_URL,
  mapOpenRouteFeature,
  setOpenRouteFetcherForTests,
  setOpenRouteTimeoutForTests,
  OpenRouteServiceProvider,
} from "@/lib/routing/openrouteservice";
import { RoutingTimeoutError } from "@/lib/routing/provider";

afterEach(() => {
  setOpenRouteFetcherForTests(null);
  setOpenRouteTimeoutForTests(null);
  serverRoadRouteCache.clear();
  delete process.env.OPENROUTESERVICE_API_KEY;
});

const SAMPLE_PAYLOAD = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [153.006, -27.47],
          [153.01, -27.48],
          [153.02, -27.5],
        ],
      },
      properties: {
        summary: { distance: 16400, duration: 1380 },
        segments: [
          { distance: 8000, duration: 720 },
          { distance: 8400, duration: 660 },
        ],
      },
    },
  ],
};

describe("openrouteservice mapper", () => {
  it("A. maps a successful GeoJSON directions response", () => {
    const route = mapOpenRouteFeature(SAMPLE_PAYLOAD, 2);
    assert.equal(route.geometry.type, "LineString");
    assert.equal(route.geometry.coordinates.length, 3);
    assert.deepEqual(route.geometry.coordinates[0], [153.006, -27.47]);
    assert.equal(route.totalDistanceMeters, 16400);
    assert.equal(route.totalDurationSeconds, 1380);
    assert.equal(route.legs.length, 2);
    assert.equal(route.legs[0].durationSeconds, 720);
    assert.equal(route.legs[1].distanceMeters, 8400);
  });

  it("G. times out instead of hanging", async () => {
    process.env.OPENROUTESERVICE_API_KEY = "test-key";
    setOpenRouteTimeoutForTests(30);
    setOpenRouteFetcherForTests((_url, init) => {
      assert.equal(_url, OPENROUTESERVICE_DIRECTIONS_URL);
      return new Promise((_, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    });
    const provider = new OpenRouteServiceProvider();
    await assert.rejects(
      () =>
        provider.getDrivingRoute([
          [153.006, -27.47],
          [152.973, -27.5],
        ]),
      (error: unknown) => error instanceof RoutingTimeoutError
    );
  });
});
