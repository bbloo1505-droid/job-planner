import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GOOGLE_BASEMAP_STYLES } from "@/lib/map/google-basemap-style";
import {
  candidatePolylineStyle,
  insertionExistingStyle,
  insertionProposedStyle,
  schematicPath,
  toLatLngLiteral,
  weeklyPathStyle,
} from "@/lib/map/google-view-helpers";

describe("Google schematic overlay helpers", () => {
  it("sends coordinates only, never address strings", () => {
    const point = toLatLngLiteral({ lat: -26.6268, lng: 152.9594 });
    assert.deepEqual(Object.keys(point).sort(), ["lat", "lng"]);
    assert.equal("address" in point, false);
    const path = schematicPath([
      { lat: -26.6552, lng: 153.0902 },
      { lat: -26.6268, lng: 152.9594 },
      { lat: -26.6844, lng: 153.057 },
    ]);
    assert.equal(path.length, 3);
    for (const item of path) {
      assert.deepEqual(Object.keys(item).sort(), ["lat", "lng"]);
    }
  });

  it("keeps candidate links schematic and ranked by prominence", () => {
    const first = candidatePolylineStyle(1);
    const second = candidatePolylineStyle(2);
    const third = candidatePolylineStyle(3);
    assert.equal(first.geodesic, false);
    assert.equal(second.geodesic, false);
    assert.equal(third.geodesic, false);
    assert.equal(first.zIndex > second.zIndex, true);
    assert.equal(second.zIndex > third.zIndex, true);
    assert.equal((first.icons?.length ?? 0) > 0, true);
  });

  it("distinguishes existing path from proposed insertion in Prensa blue", () => {
    const existing = insertionExistingStyle();
    const proposed = insertionProposedStyle();
    assert.equal(existing.geodesic, false);
    assert.equal(proposed.geodesic, false);
    assert.equal(proposed.strokeColor, "#1b7ab8");
    assert.equal(proposed.strokeOpacity > existing.strokeOpacity, true);
  });

  it("keeps weekly paths schematic", () => {
    const weekly = weeklyPathStyle("#1b7ab8");
    assert.equal(weekly.geodesic, false);
    assert.equal(weekly.strokeOpacity < 0.5, true);
  });

  it("hides business POIs on the Google basemap style", () => {
    const hidden = GOOGLE_BASEMAP_STYLES.filter((item) =>
      JSON.stringify(item.stylers ?? []).includes('"visibility":"off"')
    );
    assert.equal(
      hidden.some((item) => item.featureType === "poi" || item.featureType === "poi.business"),
      true
    );
    assert.equal(
      hidden.some((item) => item.featureType === "transit"),
      true
    );
  });
});
