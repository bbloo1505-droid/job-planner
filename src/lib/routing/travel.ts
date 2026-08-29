import { haversineDistanceKm } from "@/lib/geo";
import type { GeoPoint } from "@/lib/types";

/** Prototype SEQ urban average — not live road speed. */
export const AVG_SEQ_URBAN_KMH = 45;

export interface TravelEstimator {
  estimateTravelMinutes(
    from: GeoPoint,
    to: GeoPoint,
    bufferMinutes: number
  ): number;
}

export class HaversineTravelEstimator implements TravelEstimator {
  estimateTravelMinutes(
    from: GeoPoint,
    to: GeoPoint,
    bufferMinutes: number
  ): number {
    const km = haversineDistanceKm(from, to);
    if (km < 0.05) return 0;
    const drivingMinutes = (km / AVG_SEQ_URBAN_KMH) * 60;
    return Math.max(1, Math.round(drivingMinutes + bufferMinutes));
  }
}

/** Stage 1 estimator. Replace with an IT-approved routing API in Stage 2. */
export const travelEstimator: TravelEstimator = new HaversineTravelEstimator();

export function estimateTravelMinutes(
  from: GeoPoint,
  to: GeoPoint,
  bufferMinutes: number
): number {
  return travelEstimator.estimateTravelMinutes(from, to, bufferMinutes);
}

/** Null when either endpoint is unresolved — never invent a 0-minute drive. */
export function estimateTravelMinutesOrNull(
  from: GeoPoint | null,
  to: GeoPoint | null,
  bufferMinutes: number
): number | null {
  if (!from || !to) return null;
  return estimateTravelMinutes(from, to, bufferMinutes);
}
