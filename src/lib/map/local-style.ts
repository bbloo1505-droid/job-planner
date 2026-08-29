import type { StyleSpecification } from "maplibre-gl";
import queenslandContext from "@/data/maps/queensland-context.json";
import { allocationOverlayLayers, allocationOverlaySources } from "@/lib/map/allocation-overlays";

/** Recursively collect string values that look like network URLs. */
export function collectNetworkUrls(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) || value.startsWith("//")) found.push(value);
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNetworkUrls(item, found);
    return found;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectNetworkUrls(item, found);
  }
  return found;
}

export function queenslandContextData(): GeoJSON.FeatureCollection {
  return queenslandContext as GeoJSON.FeatureCollection;
}

/**
 * MapLibre style with only bundled GeoJSON. No glyphs, sprites, or tiles.
 */
export function createLocalMapStyle(): StyleSpecification {
  return {
    version: 8,
    name: "prensa-local-qld",
    sources: {
      context: {
        type: "geojson",
        data: queenslandContext as GeoJSON.FeatureCollection,
      },
      ...allocationOverlaySources(),
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#dce5ee" },
      },
      {
        id: "qld-fill",
        type: "fill",
        source: "context",
        filter: ["==", ["get", "kind"], "state"],
        paint: {
          "fill-color": "#f4f6f8",
          "fill-outline-color": "#c5d0db",
        },
      },
      {
        id: "seq-fill",
        type: "fill",
        source: "context",
        filter: ["==", ["get", "kind"], "seq"],
        paint: {
          "fill-color": "#eef3f8",
          "fill-opacity": 0.7,
        },
      },
      {
        id: "qld-outline",
        type: "line",
        source: "context",
        filter: ["==", ["get", "kind"], "state"],
        paint: {
          "line-color": "#9aa8b8",
          "line-width": 1.15,
        },
      },
      {
        id: "seq-outline",
        type: "line",
        source: "context",
        filter: ["==", ["get", "kind"], "seq"],
        paint: {
          "line-color": "#b7c4d2",
          "line-width": 0.9,
          "line-dasharray": [3, 2],
        },
      },
      ...allocationOverlayLayers(),
    ],
  };
}

export const QLD_MAX_BOUNDS: [[number, number], [number, number]] = [
  [137.2, -30.4],
  [154.8, -9.8],
];
