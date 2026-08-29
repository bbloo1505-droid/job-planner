import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { POST } from "@/app/api/route/route";
import { setRoutingProviderForTests } from "@/lib/routing/directions";
import { serverRoadRouteCache } from "@/lib/routing/route-cache";
import {
  RoutingTimeoutError,
  RoutingUnavailableError,
  type RoadRoute,
  type RoutingProvider,
} from "@/lib/routing/provider";

afterEach(() => {
  setRoutingProviderForTests(null);
  serverRoadRouteCache.clear();
});

const SAMPLE: RoadRoute = {
  geometry: {
    type: "LineString",
    coordinates: [
      [153.006, -27.47],
      [152.973, -27.5],
    ],
  },
  totalDistanceMeters: 8200,
  totalDurationSeconds: 720,
  legs: [{ distanceMeters: 8200, durationSeconds: 720 }],
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/route", () => {
  it("returns a normalized route from the provider", async () => {
    const provider: RoutingProvider = {
      getDrivingRoute: async (coordinates) => {
        assert.equal(coordinates.length, 2);
        assert.equal(coordinates[0][0], 153.006);
        return SAMPLE;
      },
    };
    setRoutingProviderForTests(provider);
    const response = await POST(
      request({
        coordinates: [
          [153.006, -27.47],
          [152.973, -27.5],
        ],
      })
    );
    assert.equal(response.status, 200);
    const payload = (await response.json()) as { route: RoadRoute };
    assert.equal(payload.route.totalDurationSeconds, 720);
    assert.equal(payload.route.geometry.type, "LineString");
  });

  it("rejects invalid coordinates", async () => {
    const response = await POST(request({ coordinates: [[200, -27]] }));
    assert.equal(response.status, 400);
  });

  it("maps provider timeout to 504", async () => {
    setRoutingProviderForTests({
      getDrivingRoute: async () => {
        throw new RoutingTimeoutError();
      },
    });
    const response = await POST(
      request({
        coordinates: [
          [153.006, -27.47],
          [152.973, -27.5],
        ],
      })
    );
    assert.equal(response.status, 504);
  });

  it("maps no-route errors to 502", async () => {
    setRoutingProviderForTests({
      getDrivingRoute: async () => {
        throw new RoutingUnavailableError("No route found");
      },
    });
    const response = await POST(
      request({
        coordinates: [
          [153.006, -27.47],
          [152.973, -27.5],
        ],
      })
    );
    assert.equal(response.status, 502);
    const payload = (await response.json()) as { error: string };
    assert.equal(payload.error, "no_route");
  });
});
