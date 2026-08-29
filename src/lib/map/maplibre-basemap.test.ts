import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OPENFREEMAP_HOST,
  OPENFREEMAP_STYLE_URL,
  isDisallowedBasemapUrl,
  isOpenFreeMapAssetUrl,
  openFreeMapTransformUrl,
} from "@/lib/map/maplibre-basemap";
import { allocationOverlayLayers, allocationOverlaySources } from "@/lib/map/allocation-overlays";

describe("OpenFreeMap basemap", () => {
  it("uses the public Liberty style on tiles.openfreemap.org", () => {
    assert.equal(OPENFREEMAP_STYLE_URL, "https://tiles.openfreemap.org/styles/liberty");
    assert.equal(OPENFREEMAP_HOST, "tiles.openfreemap.org");
    assert.equal(isOpenFreeMapAssetUrl(OPENFREEMAP_STYLE_URL), true);
    assert.equal(isOpenFreeMapAssetUrl("https://tiles.openfreemap.org/planet"), true);
    assert.equal(isOpenFreeMapAssetUrl("https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/0-255.pbf"), true);
  });

  it("does not allow Google, Mapbox, Azure, OSM raster, or geocoding/routing hosts", () => {
    assert.equal(isDisallowedBasemapUrl("https://maps.googleapis.com/maps/api/js"), true);
    assert.equal(isDisallowedBasemapUrl("https://api.mapbox.com/styles/v1/mapbox/streets-v12"), true);
    assert.equal(isDisallowedBasemapUrl("https://atlas.microsoft.com/map/tile"), true);
    assert.equal(isDisallowedBasemapUrl("https://tile.openstreetmap.org/8/234/153.png"), true);
    assert.equal(isDisallowedBasemapUrl("https://nominatim.openstreetmap.org/search?q=Nambour"), true);
    assert.equal(isDisallowedBasemapUrl("https://router.project-osrm.org/route/v1/driving/0,0;1,1"), true);
    assert.equal(isDisallowedBasemapUrl("https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson"), true);
    assert.equal(isDisallowedBasemapUrl("https://api.openrouteservice.org/v2/directions/driving-car/geojson"), true);
    assert.equal(openFreeMapTransformUrl("https://tile.openstreetmap.org/8/234/153.png"), null);
    assert.equal(openFreeMapTransformUrl("https://nominatim.openstreetmap.org/search?q=Nambour"), null);
    assert.equal(openFreeMapTransformUrl("https://api.mapbox.com/geocoding/v5/mapbox.places/Nambour.json"), null);
  });

  it("does not put job metadata in the style URL", () => {
    assert.equal(/nambour|prensa|tj-120|job/i.test(OPENFREEMAP_STYLE_URL), false);
  });

  it("reuses the same operational overlay sources for both MapLibre basemaps", () => {
    const sources = allocationOverlaySources();
    assert.equal(sources.jobs.type, "geojson");
    if (sources.jobs.type === "geojson") assert.equal(sources.jobs.cluster, true);
    const ids = allocationOverlayLayers().map((layer) => layer.id);
    for (const id of [
      "weekly-path",
      "candidate-link-1",
      "preview-proposed",
      "jobs-point-hit",
    ]) {
      assert.equal(ids.includes(id), true, id);
    }
  });

  it("does not import ranking or geocoding into the MapLibre renderer", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "maplibre-allocation-provider.ts"),
      "utf8"
    );
    assert.equal(src.includes("rankAllocationCandidates"), false);
    assert.equal(src.includes("calculateBestInsertion"), false);
    assert.equal(src.includes("geocodeAddress"), false);
  });

  it("keeps the Day Route OpenFreeMap renderer free of job metadata and geocoding", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "day-route-map-provider.ts"),
      "utf8"
    );
    assert.equal(src.includes("geocodeAddress"), false);
    assert.equal(src.includes("nominatim"), false);
    assert.equal(src.includes("osrm"), false);
    assert.equal(src.includes("PR-TEST"), false);
    assert.equal(src.includes("OPENFREEMAP_STYLE_URL"), true);
    assert.equal(src.includes("openFreeMapTransformRequest"), true);
    assert.equal(src.includes("nominatim.openstreetmap.org"), false);
  });
});
