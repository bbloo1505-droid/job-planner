import type { GeoPoint } from "@/lib/types";
import { QLD_MAX_BOUNDS } from "@/lib/map/local-style";

export const GOOGLE_SEQ_CENTER = { lat: -27.22, lng: 153.02 };
export const GOOGLE_SINGLE_MARKER_ZOOM = 10.4;
export const GOOGLE_DEFAULT_ZOOM = 8;
export const GOOGLE_MIN_ZOOM = 5;
export const GOOGLE_MAX_ZOOM = 13;

export type LatLngLiteral = { lat: number; lng: number };

export type SchematicLineStyle = {
  geodesic: false;
  strokeColor: string;
  strokeOpacity: number;
  strokeWeight: number;
  zIndex: number;
  icons?: Array<{
    icon: { path: string; strokeOpacity: number; scale: number; strokeColor?: string };
    offset: string;
    repeat: string;
  }>;
};

/** Coordinates only. Never include address or job text. */
export function toLatLngLiteral(point: Pick<GeoPoint, "lat" | "lng">): LatLngLiteral {
  return { lat: point.lat, lng: point.lng };
}

export function qldRestrictionBounds(): {
  south: number;
  west: number;
  north: number;
  east: number;
} {
  return {
    west: QLD_MAX_BOUNDS[0][0],
    south: QLD_MAX_BOUNDS[0][1],
    east: QLD_MAX_BOUNDS[1][0],
    north: QLD_MAX_BOUNDS[1][1],
  };
}

export function candidatePolylineStyle(rank: number): SchematicLineStyle {
  if (rank <= 1) {
    return dashedLine({
      color: "#1a2744",
      weight: 1.6,
      dashOpacity: 0.72,
      scale: 3.2,
      repeat: "14px",
      zIndex: 8,
    });
  }
  if (rank === 2) {
    return dashedLine({
      color: "#64748b",
      weight: 1.15,
      dashOpacity: 0.5,
      scale: 2.6,
      repeat: "13px",
      zIndex: 7,
    });
  }
  return dashedLine({
    color: "#94a3b8",
    weight: 1,
    dashOpacity: 0.35,
    scale: 2.2,
    repeat: "12px",
    zIndex: 6,
  });
}

export function insertionExistingStyle(): SchematicLineStyle {
  return {
    geodesic: false,
    strokeColor: "#64748b",
    strokeOpacity: 0.38,
    strokeWeight: 2,
    zIndex: 4,
  };
}

export function insertionProposedStyle(): SchematicLineStyle {
  return {
    geodesic: false,
    strokeColor: "#1b7ab8",
    strokeOpacity: 0.9,
    strokeWeight: 2.4,
    zIndex: 5,
  };
}

export function weeklyPathStyle(colour: string): SchematicLineStyle {
  return {
    geodesic: false,
    strokeColor: colour,
    strokeOpacity: 0.28,
    strokeWeight: 1.4,
    zIndex: 3,
  };
}

export function schematicPath(points: Array<Pick<GeoPoint, "lat" | "lng">>): LatLngLiteral[] {
  return points.map(toLatLngLiteral);
}

function dashedLine(input: {
  color: string;
  weight: number;
  dashOpacity: number;
  scale: number;
  repeat: string;
  zIndex: number;
}): SchematicLineStyle {
  return {
    geodesic: false,
    strokeColor: input.color,
    strokeOpacity: 0,
    strokeWeight: input.weight,
    zIndex: input.zIndex,
    icons: [
      {
        icon: {
          path: "M 0,-1 0,1",
          strokeOpacity: input.dashOpacity,
          strokeColor: input.color,
          scale: input.scale,
        },
        offset: "0",
        repeat: input.repeat,
      },
    ],
  };
}
