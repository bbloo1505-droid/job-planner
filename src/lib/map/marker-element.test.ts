import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { jobMarkerLngLat } from "@/lib/map/marker-element";

const dir = dirname(fileURLToPath(import.meta.url));

describe("job marker geographic anchor", () => {
  it("uses the stored job longitude/latitude, not a projected pixel", () => {
    assert.deepEqual(jobMarkerLngLat({ lng: 153.091, lat: -26.626 }), [153.091, -26.626]);
  });

  it("does not apply transform or flow positioning to the MapLibre marker root", () => {
    const css = readFileSync(join(dir, "../../app/globals.css"), "utf8");
    const anchor = css.match(/\.prensa-map-marker-anchor\s*\{[^}]*\}/);
    assert.ok(anchor);
    assert.doesNotMatch(anchor[0], /transform\s*:/);
    assert.doesNotMatch(anchor[0], /position\s*:/);
    assert.doesNotMatch(anchor[0], /\bleft\s*:/);
    assert.doesNotMatch(anchor[0], /\btop\s*:/);
  });

  it("keeps MapLibre transform ownership on the provider root", () => {
    const provider = readFileSync(join(dir, "maplibre-allocation-provider.ts"), "utf8");
    assert.match(provider, /new Marker\(\{ element: el, anchor: "center" \}\)/);
    assert.match(provider, /jobMarkerLngLat\(item\)/);
    assert.equal(/this\.map\.on\("move"\)/.test(provider), false);
    assert.equal(provider.includes("map.project("), false);
    assert.equal(provider.includes("style.left"), false);
    assert.equal(provider.includes("style.top"), false);
  });

  it("does not assign className on the MapLibre-managed root", () => {
    const src = readFileSync(join(dir, "marker-element.ts"), "utf8");
    assert.match(src, /el\.classList\.add\(MARKER_ANCHOR_CLASS\)/);
    assert.equal(/el\.className\s*=/.test(src), false);
  });
});
