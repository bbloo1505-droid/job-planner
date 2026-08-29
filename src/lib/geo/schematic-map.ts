import type { GeoPoint } from "@/lib/types";

/**
 * Legacy SVG projection helpers kept for unit tests.
 * The Team Planner map now uses MAP_PROVIDER_KIND = local-maplibre.
 */
export const MAP_PROVIDER_KIND = "schematic-svg" as const;

export const SCHEMATIC_MAP_NOTICE = "Prototype geographic view — not road routing";

export interface SchematicViewport {
  width: number;
  height: number;
  pad: number;
}

export interface SchematicBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** Muted region captions for SEQ clusters. Not streets and not to scale. */
export const SEQ_REGION_LABELS: { id: string; label: string; point: GeoPoint }[] = [
  { id: "sunshine-coast", label: "Sunshine Coast", point: { lat: -26.65, lng: 153.05 } },
  { id: "north-brisbane", label: "North Brisbane", point: { lat: -27.08, lng: 152.96 } },
  { id: "brisbane", label: "Brisbane", point: { lat: -27.47, lng: 153.03 } },
  { id: "western", label: "Western corridor", point: { lat: -27.56, lng: 151.95 } },
  { id: "gold-coast", label: "Gold Coast", point: { lat: -28.02, lng: 153.4 } },
];

export function fitSchematicBounds(
  points: GeoPoint[],
  minSpan = 0.08
): SchematicBounds | null {
  if (points.length === 0) return null;
  let minLat = Math.min(...points.map((item) => item.lat));
  let maxLat = Math.max(...points.map((item) => item.lat));
  let minLng = Math.min(...points.map((item) => item.lng));
  let maxLng = Math.max(...points.map((item) => item.lng));
  if (maxLat - minLat < minSpan) {
    const mid = (minLat + maxLat) / 2;
    minLat = mid - minSpan / 2;
    maxLat = mid + minSpan / 2;
  }
  if (maxLng - minLng < minSpan) {
    const mid = (minLng + maxLng) / 2;
    minLng = mid - minSpan / 2;
    maxLng = mid + minSpan / 2;
  }
  const latPad = (maxLat - minLat) * 0.18;
  const lngPad = (maxLng - minLng) * 0.18;
  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
  };
}

export function projectLngLat(
  point: GeoPoint,
  bounds: SchematicBounds,
  viewport: SchematicViewport
): { x: number; y: number } {
  const { width, height, pad } = viewport;
  const x =
    pad + ((point.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * (width - pad * 2);
  const y =
    pad + ((bounds.maxLat - point.lat) / (bounds.maxLat - bounds.minLat)) * (height - pad * 2);
  return { x, y };
}

export function isInViewport(
  x: number,
  y: number,
  viewport: SchematicViewport,
  margin = 4
): boolean {
  return (
    x >= margin &&
    y >= margin &&
    x <= viewport.width - margin &&
    y <= viewport.height - margin
  );
}

function idAngle(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return ((hash % 360) * Math.PI) / 180;
}

/**
 * Visual-only spacing for overlapping projected markers.
 * Does not change stored latitude/longitude.
 */
export function separateOverlappingPoints<T extends { id: string; x: number; y: number }>(
  items: T[],
  minDist = 26
): T[] {
  const next = items.map((item) => ({ ...item }));
  const order = [...next].sort((a, b) => a.id.localeCompare(b.id));
  for (let pass = 0; pass < 5; pass += 1) {
    for (let i = 0; i < order.length; i += 1) {
      for (let j = i + 1; j < order.length; j += 1) {
        const a = order[i];
        const b = order[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= minDist) continue;
        const angle = dist < 0.05 ? idAngle(`${a.id}|${b.id}`) : Math.atan2(dy, dx);
        const ux = Math.cos(angle);
        const uy = Math.sin(angle);
        const push = (minDist - Math.max(dist, 0.05)) / 2;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
      }
    }
  }
  return order;
}

export function labelsCollide(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  minDx = 46,
  minDy = 14
): boolean {
  return Math.abs(ax - bx) < minDx && Math.abs(ay - by) < minDy;
}
