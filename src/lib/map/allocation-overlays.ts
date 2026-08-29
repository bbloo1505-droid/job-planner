import type { LayerSpecification, SourceSpecification } from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";

export function emptyGeoJSON(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

/** Operational overlay sources shared by local and OpenFreeMap MapLibre maps. */
export function allocationOverlaySources(): Record<string, SourceSpecification> {
  return {
    jobs: {
      type: "geojson",
      data: emptyGeoJSON(),
      cluster: true,
      clusterMaxZoom: 7,
      clusterRadius: 36,
    },
    links: {
      type: "geojson",
      data: emptyGeoJSON(),
    },
    preview: {
      type: "geojson",
      data: emptyGeoJSON(),
    },
    weekly: {
      type: "geojson",
      data: emptyGeoJSON(),
    },
  };
}

/** Schematic job overlays drawn above whatever basemap is active. */
export function allocationOverlayLayers(): LayerSpecification[] {
  return [
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
  ];
}

export function addAllocationOverlays(map: MapLibreMap): void {
  const sources = allocationOverlaySources();
  for (const [id, spec] of Object.entries(sources)) {
    if (!map.getSource(id)) map.addSource(id, spec);
  }
  for (const layer of allocationOverlayLayers()) {
    if (!map.getLayer(layer.id)) map.addLayer(layer);
  }
}
