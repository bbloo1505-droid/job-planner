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
  "https://api.openrouteservice.org/v2/directions/driving-car/json";

export const OPENROUTESERVICE_FALLBACK_URL =
  "https://api.heigit.org/openrouteservice/v2/directions/driving-car/json";

const DIRECTIONS_URLS = [OPENROUTESERVICE_DIRECTIONS_URL, OPENROUTESERVICE_FALLBACK_URL];

/** Fastest road path, including tollways. Times are free-flow, not live traffic. */
export const OPENROUTE_DIRECTIONS_BODY = {
  geometry: true,
  preference: "fastest" as const,
};

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
  if (!payload || typeof payload !== "object") {
    throw new RoutingUnavailableError("Malformed routing response");
  }
  const body = payload as Record<string, unknown>;
  if (Array.isArray(body.routes)) {
    return mapOpenRouteJson(body, expectedLegs);
  }
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
  return finishRoute(
    coordinates,
    (properties.summary ?? {}) as Record<string, unknown>,
    Array.isArray(properties.segments) ? properties.segments : [],
    expectedLegs
  );
}

/** Google encoded polyline → [lng, lat] pairs. ORS JSON geometry uses precision 5. */
export function decodeOpenRoutePolyline(encoded: string, precision = 5): Array<[number, number]> {
  const coordinates: Array<[number, number]> = [];
  const factor = 10 ** precision;
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    lat += nextDelta();
    lng += nextDelta();
    coordinates.push([lng / factor, lat / factor]);
  }

  function nextDelta(): number {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      if (index >= encoded.length) break;
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  }

  return coordinates;
}

async function fetchOpenRoute(
  coordinates: Array<[number, number]>
): Promise<RoadRoute> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), openRouteTimeoutMs);
  try {
    let lastStatus = 0;
    for (const url of DIRECTIONS_URLS) {
      const response = await openRouteFetcher(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: getOpenRouteServiceApiKey(),
        },
        body: JSON.stringify({
          coordinates,
          ...OPENROUTE_DIRECTIONS_BODY,
        }),
        cache: "no-store",
        signal: controller.signal,
      });
      lastStatus = response.status;
      if (response.status === 429) {
        throw new RoutingUnavailableError("Routing rate limited");
      }
      if (response.ok) {
        const payload: unknown = await response.json();
        return mapOpenRouteFeature(payload, coordinates.length - 1);
      }
      if (!shouldTryNextDirectionsHost(response.status)) {
        throw new RoutingUnavailableError(`Routing returned ${response.status}`);
      }
    }
    throw new RoutingUnavailableError(`Routing returned ${lastStatus || "error"}`);
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

function shouldTryNextDirectionsHost(status: number): boolean {
  return status === 401 || status === 403 || status === 404 || status === 406 || status >= 500;
}

function mapOpenRouteJson(
  body: Record<string, unknown>,
  expectedLegs: number
): RoadRoute {
  const routes = body.routes as unknown[];
  const route = (routes[0] ?? null) as Record<string, unknown> | null;
  if (!route) {
    throw new RoutingUnavailableError("Malformed routing response");
  }
  const encoded = route.geometry;
  const coordinates =
    typeof encoded === "string"
      ? decodeOpenRoutePolyline(encoded)
      : encoded && typeof encoded === "object"
        ? lineStringFromUnknown((encoded as { coordinates?: unknown }).coordinates)
        : [];
  if (coordinates.length < 2) {
    throw new RoutingUnavailableError("Malformed route geometry");
  }
  return finishRoute(
    coordinates,
    (route.summary ?? {}) as Record<string, unknown>,
    Array.isArray(route.segments) ? route.segments : [],
    expectedLegs
  );
}

function finishRoute(
  coordinates: Array<[number, number]>,
  summary: Record<string, unknown>,
  segments: unknown[],
  expectedLegs: number
): RoadRoute {
  const legs: RouteLeg[] = segments.map((segment) => {
    const row = (segment ?? {}) as Record<string, unknown>;
    return {
      distanceMeters: Number(row.distance) || 0,
      durationSeconds: Number(row.duration) || 0,
    };
  });
  if (legs.length === 0 && expectedLegs === 1) {
    const distanceMeters = Number(summary.distance) || 0;
    const durationSeconds = Number(summary.duration) || 0;
    if (distanceMeters > 0 || durationSeconds > 0) {
      legs.push({ distanceMeters, durationSeconds });
    }
  }
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

function lineStringFromUnknown(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) return [];
  const coordinates: Array<[number, number]> = [];
  for (const pair of value) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lng = Number(pair[0]);
    const lat = Number(pair[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    coordinates.push([lng, lat]);
  }
  return coordinates;
}

function extractFeature(payload: unknown): {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: unknown;
} {
  if (!payload || typeof payload !== "object") {
    throw new RoutingUnavailableError("Malformed routing response");
  }
  const body = payload as Record<string, unknown>;
  if (body.type === "Feature") {
    return body as { geometry?: { type?: string; coordinates?: unknown }; properties?: unknown };
  }
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
