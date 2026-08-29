import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

describe("Google Maps provider isolation", () => {
  it("does not import the allocation ranking engine", () => {
    const src = readFileSync(join(dir, "google-maps-provider.ts"), "utf8");
    assert.equal(src.includes("rankAllocationCandidates"), false);
    assert.equal(src.includes("calculateBestInsertion"), false);
    assert.equal(src.includes("geocodeAddress"), false);
  });

  it("does not call Google geocoding, places, or routes services", () => {
    const src = readFileSync(join(dir, "google-maps-provider.ts"), "utf8");
    for (const token of [
      "Geocoder",
      "PlacesService",
      "Autocomplete",
      "DirectionsService",
      "DistanceMatrixService",
      "importLibrary(\"places\")",
      "importLibrary(\"geocoding\")",
      "importLibrary(\"routes\")",
    ]) {
      assert.equal(src.includes(token), false, token);
    }
  });
});
