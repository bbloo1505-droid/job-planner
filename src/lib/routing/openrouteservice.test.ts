import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { serverRoadRouteCache } from "@/lib/routing/route-cache";
import {
  OPENROUTE_DIRECTIONS_BODY,
  OPENROUTESERVICE_DIRECTIONS_URL,
  OPENROUTESERVICE_FALLBACK_URL,
  decodeOpenRoutePolyline,
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

  it("maps a JSON directions response and decodes the polyline", () => {
    const encoded = decodeOpenRoutePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    assert.equal(encoded.length, 3);
    assert.ok(Math.abs(encoded[0][0] - -120.2) < 0.001);
    assert.ok(Math.abs(encoded[0][1] - 38.5) < 0.001);

    const route = mapOpenRouteFeature(
      {
        routes: [
          {
            summary: { distance: 16400, duration: 1380 },
            segments: [
              { distance: 8000, duration: 720 },
              { distance: 8400, duration: 660 },
            ],
            geometry: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
          },
        ],
      },
      2
    );
    assert.equal(route.geometry.type, "LineString");
    assert.equal(route.geometry.coordinates.length, 3);
    assert.equal(route.legs.length, 2);
    assert.equal(route.totalDistanceMeters, 16400);
  });

  it("G. times out instead of hanging", async () => {
    process.env.OPENROUTESERVICE_API_KEY = "test-key";
    setOpenRouteTimeoutForTests(30);
    setOpenRouteFetcherForTests((_url, init) => {
      assert.equal(_url, OPENROUTESERVICE_DIRECTIONS_URL);
      const body = JSON.parse(String(init.body)) as { preference?: string };
      assert.equal(body.preference, OPENROUTE_DIRECTIONS_BODY.preference);
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

  it("falls back to HeiGIT when the official host rejects the format", async () => {
    process.env.OPENROUTESERVICE_API_KEY = "test-key";
    const urls: string[] = [];
    setOpenRouteFetcherForTests(async (url) => {
      urls.push(url);
      if (url === OPENROUTESERVICE_DIRECTIONS_URL) {
        return new Response("This response format is not supported", { status: 406 });
      }
      return Response.json({
        routes: [
          {
            summary: { distance: 5638, duration: 722 },
            segments: [{ distance: 5638, duration: 722 }],
            geometry: {
              type: "LineString",
              coordinates: [
                [153.006, -27.47],
                [152.973, -27.5],
              ],
            },
          },
        ],
      });
    });
    const provider = new OpenRouteServiceProvider();
    const route = await provider.getDrivingRoute([
      [153.006, -27.47],
      [152.973, -27.5],
    ]);
    assert.deepEqual(urls, [OPENROUTESERVICE_DIRECTIONS_URL, OPENROUTESERVICE_FALLBACK_URL]);
    assert.equal(route.legs.length, 1);
    assert.equal(route.totalDistanceMeters, 5638);
  });
});
