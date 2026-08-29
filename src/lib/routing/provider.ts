import type { GeoPoint } from "@/lib/types";

export const ROUTE_TIMEOUT_MS = 10_000;
export const MAX_ROUTE_COORDINATES = 25;

export interface RouteLeg {
  distanceMeters: number;
  durationSeconds: number;
}

export interface LineStringGeometry {
  type: "LineString";
  coordinates: Array<[number, number]>;
}

export interface RoadRoute {
  geometry: LineStringGeometry;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  legs: RouteLeg[];
}

export interface RoutingProvider {
  getDrivingRoute(coordinates: Array<[number, number]>): Promise<RoadRoute>;
}

export class RoutingTimeoutError extends Error {
  constructor(message = "Routing timed out") {
    super(message);
    this.name = "RoutingTimeoutError";
  }
}

export class RoutingUnavailableError extends Error {
  constructor(message = "Routing unavailable") {
    super(message);
    this.name = "RoutingUnavailableError";
  }
}

export function routeCacheKey(coordinates: Array<[number, number]>): string {
  return coordinates
    .map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`)
    .join("|");
}

export function isValidLngLat(value: unknown): value is [number, number] {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const lng = Number(value[0]);
  const lat = Number(value[1]);
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

export function durationSecondsToMinutes(
  durationSeconds: number,
  distanceMeters: number
): number {
  if (distanceMeters < 50 && durationSeconds < 30) return 0;
  if (durationSeconds <= 0) return distanceMeters >= 50 ? 1 : 0;
  return Math.max(1, Math.round(durationSeconds / 60));
}

export function geometryToPoints(geometry: LineStringGeometry): GeoPoint[] {
  return geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
}

export interface TravelLegOverride {
  minutes: number | null;
  meters?: number | null;
}

export function travelLegsFromRoute(route: RoadRoute): TravelLegOverride[] {
  return route.legs.map((leg) => ({
    minutes: durationSecondsToMinutes(leg.durationSeconds, leg.distanceMeters),
    meters: leg.distanceMeters,
  }));
}
