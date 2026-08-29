import type { GeoPoint } from "@/lib/types";
import type {
  CandidateLinkModel,
  InsertionPreviewModel,
  MapMarkerModel,
  WeeklyPathModel,
} from "@/lib/map/allocation-map-model";
import { DEFAULT_MAP_PROVIDER, type MapProviderKind } from "@/lib/map/config";

/** Default Stage 1 basemap. Runtime selection uses NEXT_PUBLIC_MAP_PROVIDER. */
export const MAP_PROVIDER_KIND: MapProviderKind = DEFAULT_MAP_PROVIDER;

export type { MapProviderKind };

export const LOCAL_MAP_NOTICE = "Prototype map — no live road routing";
export const LOCAL_TRAVEL_NOTICE = "Travel estimates are not live road routing";
export const WEEKLY_PATH_NOTICE = "Weekly deployment path — schematic";
export const OPENFREEMAP_MAP_NOTICE = "OpenFreeMap prototype";
export const OPENFREEMAP_OSM_NOTICE = "Map data © OpenStreetMap";
export const OPENFREEMAP_TRAVEL_NOTICE = "Travel estimates are not live road routing";
export const SCHEMATIC_ROUTE_LINE_NOTICE = "Schematic route line — not live road routing";
export const ROAD_ROUTE_ORS_NOTICE =
  "Estimated road travel via openrouteservice — no live traffic";
export const ESTIMATED_ROUTE_NOTICE = "Estimated route — live road routing unavailable";
export const GOOGLE_MAP_NOTICE = "Google Maps prototype";
export const GOOGLE_SYNTHETIC_NOTICE = "Synthetic job coordinates only";
export const GOOGLE_TRAVEL_NOTICE = "Allocation travel remains locally estimated";
export const SCHEMATIC_INSERTION_NOTICE = "Schematic insertion preview";

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
