import type { StyleSpecification } from "maplibre-gl";
import queenslandContext from "@/data/maps/queensland-context.json";

function emptyCollection(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

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
      jobs: {
        type: "geojson",
        data: emptyCollection(),
        cluster: true,
        clusterMaxZoom: 7,
        clusterRadius: 36,
      },
      links: {
        type: "geojson",
        data: emptyCollection(),
      },
      preview: {
        type: "geojson",
        data: emptyCollection(),
      },
      weekly: {
        type: "geojson",
        data: emptyCollection(),
      },
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
      {
        id: "weekly-path",
        type: "line",
        source: "weekly",
        paint: {
          "line-color": ["coalesce", ["get", "colour"], "#64748b"],
          "line-width": 1.4,
          "line-opacity": 0.28,
        },
      },
      {
        id: "candidate-link-3",
        type: "line",
        source: "links",
        filter: ["==", ["get", "rank"], 3],
        paint: {
          "line-color": "#94a3b8",
          "line-width": 1,
          "line-dasharray": [2, 3],
          "line-opacity": 0.35,
        },
      },
      {
        id: "candidate-link-2",
        type: "line",
        source: "links",
        filter: ["==", ["get", "rank"], 2],
        paint: {
          "line-color": "#64748b",
          "line-width": 1.15,
          "line-dasharray": [3, 3],
          "line-opacity": 0.5,
        },
      },
      {
        id: "candidate-link-1",
        type: "line",
        source: "links",
        filter: ["==", ["get", "rank"], 1],
        paint: {
          "line-color": "#1a2744",
          "line-width": 1.6,
          "line-dasharray": [4, 3],
          "line-opacity": 0.72,
        },
      },
      {
        id: "preview-existing",
        type: "line",
        source: "preview",
        filter: ["==", ["get", "kind"], "existing"],
        paint: {
          "line-color": "#64748b",
          "line-width": 2,
          "line-opacity": 0.38,
        },
      },
      {
        id: "preview-proposed",
        type: "line",
        source: "preview",
        filter: ["==", ["get", "kind"], "proposed"],
        paint: {
          "line-color": "#1b7ab8",
          "line-width": 2.4,
          "line-opacity": 0.9,
        },
      },
      {
        id: "jobs-cluster-hit",
        type: "circle",
        source: "jobs",
        filter: ["has", "point_count"],
        paint: {
          "circle-radius": 18,
          "circle-opacity": 0,
        },
      },
      {
        id: "jobs-point-hit",
        type: "circle",
        source: "jobs",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 14,
          "circle-opacity": 0,
        },
      },
    ],
  };
}

export const QLD_MAX_BOUNDS: [[number, number], [number, number]] = [
  [137.2, -30.4],
  [154.8, -9.8],
];
