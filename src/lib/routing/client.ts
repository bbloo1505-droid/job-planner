import { RoadRouteCache } from "@/lib/routing/route-cache";
import {
  RoutingTimeoutError,
  RoutingUnavailableError,
  routeCacheKey,
  type LineStringGeometry,
  type RoadRoute,
} from "@/lib/routing/provider";

const clientCache = new RoadRouteCache();
const inflight = new Map<string, Promise<RoadRoute>>();

export type RouteFetcher = (
  coordinates: Array<[number, number]>
) => Promise<RoadRoute>;

let routeFetcher: RouteFetcher | null = null;

/** Test-only. Pass null to restore the browser /api/route client. */
export function setRouteFetcherForTests(fn: RouteFetcher | null): void {
  routeFetcher = fn;
}

export function clearClientRouteCacheForTests(): void {
  clientCache.clear();
  inflight.clear();
}

export async function fetchRouteFromBrowser(
  coordinates: Array<[number, number]>
): Promise<RoadRoute> {
  const key = routeCacheKey(coordinates);
  const cached = clientCache.get(key);
  if (cached) return cached;

  const existing = inflight.get(key);
  if (existing) return existing;

  const request = (routeFetcher ?? postRoute)(coordinates).then((route) => {
    clientCache.set(key, route);
    return route;
  });
  inflight.set(key, request);
  try {
    return await request;
  } finally {
    if (inflight.get(key) === request) inflight.delete(key);
  }
}

async function postRoute(coordinates: Array<[number, number]>): Promise<RoadRoute> {
  const response = await fetch("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    route?: RoadRoute;
    error?: string;
  };
  if (response.status === 504 || payload.error === "timeout") {
    throw new RoutingTimeoutError();
  }
  if (!response.ok) {
    throw new RoutingUnavailableError(
      payload.error === "rate_limited"
        ? "Routing rate limited"
        : payload.error === "no_route"
          ? "No route found"
          : payload.error === "unconfigured"
            ? "Routing is not configured"
            : "Routing unavailable"
    );
  }
  const route = payload.route;
  if (!isRoadRoute(route)) {
    throw new RoutingUnavailableError("Malformed routing response");
  }
  return route;
}

function isRoadRoute(value: unknown): value is RoadRoute {
  if (!value || typeof value !== "object") return false;
  const route = value as RoadRoute;
  return (
    isLineString(route.geometry) &&
    Array.isArray(route.legs) &&
    Number.isFinite(route.totalDistanceMeters) &&
    Number.isFinite(route.totalDurationSeconds)
  );
}

function isLineString(value: unknown): value is LineStringGeometry {
  if (!value || typeof value !== "object") return false;
  const geometry = value as LineStringGeometry;
  return (
    geometry.type === "LineString" &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length >= 2
  );
}
