import {
  MAX_ROUTE_COORDINATES,
  ROUTE_TIMEOUT_MS,
  RoutingTimeoutError,
  RoutingUnavailableError,
  routeCacheKey,
  type RoadRoute,
  type RouteLeg,
  type RoutingProvider,
} from "@/lib/routing/provider";

let openRouteTimeoutMs = ROUTE_TIMEOUT_MS;

/** Test-only. Pass null to restore the production timeout. */
export function setOpenRouteTimeoutForTests(ms: number | null): void {
  openRouteTimeoutMs = ms ?? ROUTE_TIMEOUT_MS;
}

export const OPENROUTESERVICE_DIRECTIONS_URL =
  "https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson";

export type OpenRouteFetcher = (
  url: string,
  init: RequestInit
) => Promise<Response>;

let openRouteFetcher: OpenRouteFetcher = (url, init) => fetch(url, init);

/** Test-only. Pass null to restore real fetch. Must not be used to call live ORS in tests. */
export function setOpenRouteFetcherForTests(fn: OpenRouteFetcher | null): void {
  openRouteFetcher = fn ?? ((url, init) => fetch(url, init));
}

export function getOpenRouteServiceApiKey(): string {
  return (process.env.OPENROUTESERVICE_API_KEY ?? "").trim();
}

export function isOpenRouteServiceConfigured(): boolean {
  return getOpenRouteServiceApiKey().length > 0;
}

export class OpenRouteServiceProvider implements RoutingProvider {
  getDrivingRoute(coordinates: Array<[number, number]>): Promise<RoadRoute> {
    if (coordinates.length < 2) {
      return Promise.reject(new RoutingUnavailableError("Need at least two points"));
    }
    if (coordinates.length > MAX_ROUTE_COORDINATES) {
      return Promise.reject(new RoutingUnavailableError("Too many waypoints"));
    }
    if (!isOpenRouteServiceConfigured()) {
      return Promise.reject(new RoutingUnavailableError("Routing is not configured"));
    }
    return fetchOpenRoute(coordinates);
  }
}

export function mapOpenRouteFeature(payload: unknown, expectedLegs: number): RoadRoute {
  const feature = extractFeature(payload);
  const geometry = feature.geometry;
  if (
    !geometry ||
    geometry.type !== "LineString" ||
    !Array.isArray(geometry.coordinates) ||
    geometry.coordinates.length < 2
  ) {
    throw new RoutingUnavailableError("Malformed route geometry");
  }
  const coordinates: Array<[number, number]> = [];
  for (const pair of geometry.coordinates) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lng = Number(pair[0]);
    const lat = Number(pair[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    coordinates.push([lng, lat]);
  }
  if (coordinates.length < 2) {
    throw new RoutingUnavailableError("Malformed route geometry");
  }

  const properties = (feature.properties ?? {}) as Record<string, unknown>;
  const summary = (properties.summary ?? {}) as Record<string, unknown>;
  const segments = Array.isArray(properties.segments) ? properties.segments : [];
  const legs: RouteLeg[] = segments.map((segment) => {
    const row = (segment ?? {}) as Record<string, unknown>;
    return {
      distanceMeters: Number(row.distance) || 0,
      durationSeconds: Number(row.duration) || 0,
    };
  });
  if (legs.length === 0 && expectedLegs > 0) {
    throw new RoutingUnavailableError("Route had no legs");
  }
  if (expectedLegs > 0 && legs.length !== expectedLegs) {
    throw new RoutingUnavailableError("Route leg count did not match waypoints");
  }

  return {
    geometry: { type: "LineString", coordinates },
    totalDistanceMeters: Number(summary.distance) || sum(legs, "distanceMeters"),
    totalDurationSeconds: Number(summary.duration) || sum(legs, "durationSeconds"),
    legs,
  };
}

async function fetchOpenRoute(
  coordinates: Array<[number, number]>
): Promise<RoadRoute> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), openRouteTimeoutMs);
  try {
    const response = await openRouteFetcher(OPENROUTESERVICE_DIRECTIONS_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getOpenRouteServiceApiKey(),
      },
      body: JSON.stringify({
        coordinates,
        instructions: false,
        geometry: true,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status === 429) {
      throw new RoutingUnavailableError("Routing rate limited");
    }
    if (!response.ok) {
      throw new RoutingUnavailableError(`Routing returned ${response.status}`);
    }
    const payload: unknown = await response.json();
    return mapOpenRouteFeature(payload, coordinates.length - 1);
  } catch (error) {
    if (error instanceof RoutingTimeoutError || error instanceof RoutingUnavailableError) {
      throw error;
    }
    if (
      controller.signal.aborted ||
      (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError"))
    ) {
      throw new RoutingTimeoutError();
    }
    throw new RoutingUnavailableError("Routing unavailable");
  } finally {
    clearTimeout(timer);
  }
}

function extractFeature(payload: unknown): {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: unknown;
} {
  if (!payload || typeof payload !== "object") {
    throw new RoutingUnavailableError("Malformed routing response");
  }
  const body = payload as Record<string, unknown>;
  if (body.type === "Feature") return body as { geometry?: { type?: string; coordinates?: unknown }; properties?: unknown };
  if (body.type === "FeatureCollection" && Array.isArray(body.features) && body.features[0]) {
    return body.features[0] as {
      geometry?: { type?: string; coordinates?: unknown };
      properties?: unknown;
    };
  }
  throw new RoutingUnavailableError("Malformed routing response");
}

function sum(legs: RouteLeg[], key: keyof RouteLeg): number {
  return legs.reduce((total, leg) => total + leg[key], 0);
}

export function openRouteCacheKey(coordinates: Array<[number, number]>): string {
  return routeCacheKey(coordinates);
}
