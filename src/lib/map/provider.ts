import type { GeoPoint } from "@/lib/types";
import type {
  CandidateLinkModel,
  InsertionPreviewModel,
  MapMarkerModel,
  WeeklyPathModel,
} from "@/lib/map/allocation-map-model";

/** Stage 1 interactive map. Replace with an IT-approved provider later. */
export const MAP_PROVIDER_KIND = "local-maplibre" as const;

export const LOCAL_MAP_NOTICE = "Prototype map — no live road routing";
export const LOCAL_TRAVEL_NOTICE = "Travel estimates are not live road routing";
export const WEEKLY_PATH_NOTICE = "Weekly deployment path — schematic";

export interface MapPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MapLocation extends GeoPoint {
  id?: string;
}

/**
 * Allocation map surface. Team Planner talks to this contract, not MapLibre.
 */
export interface AllocationMapProvider {
  fitToLocations(locations: MapLocation[], padding?: Partial<MapPadding>): void;
  focusLocation(location: MapLocation, zoom?: number): void;
  clearFocus(): void;
  showScheduledJobs(jobs: MapMarkerModel[]): void;
  showUnassignedJobs(jobs: MapMarkerModel[]): void;
  showCandidateLinks(links: CandidateLinkModel[]): void;
  showInsertionPreview(preview: InsertionPreviewModel | null): void;
  showWeeklyPath?(path: WeeklyPathModel | null): void;
  zoomIn?(): void;
  zoomOut?(): void;
  destroy(): void;
}

export function lngLatOf(point: GeoPoint): [number, number] {
  return [point.lng, point.lat];
}
