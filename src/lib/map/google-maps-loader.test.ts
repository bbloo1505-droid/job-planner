import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DISALLOWED_GOOGLE_SERVICE_URLS,
  GOOGLE_MAPS_ALLOWED_LIBRARIES,
  GOOGLE_MAPS_FORBIDDEN_LIBRARIES,
  isDisallowedGoogleServiceUrl,
} from "@/lib/map/google-maps-loader";

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "google-maps-loader.ts"),
  "utf8"
);

describe("Google Maps loader isolation", () => {
  it("loads only core and maps libraries", () => {
    assert.deepEqual([...GOOGLE_MAPS_ALLOWED_LIBRARIES], ["core", "maps"]);
    assert.match(src, /importLibrary\("core"\)/);
    assert.match(src, /importLibrary\("maps"\)/);
  });

  it("does not import Geocoding, Places, Routes, or Address Validation", () => {
    for (const library of GOOGLE_MAPS_FORBIDDEN_LIBRARIES) {
      assert.equal(src.includes(`importLibrary("${library}")`), false, library);
    }
    assert.equal(src.includes("libraries:"), false);
  });

  it("flags disallowed Google web service URLs", () => {
    assert.equal(DISALLOWED_GOOGLE_SERVICE_URLS.length > 0, true);
    assert.equal(isDisallowedGoogleServiceUrl("https://maps.googleapis.com/maps/api/geocode/json?address=x"), true);
    assert.equal(isDisallowedGoogleServiceUrl("https://maps.googleapis.com/maps/api/place/autocomplete/json"), true);
    assert.equal(isDisallowedGoogleServiceUrl("https://maps.googleapis.com/maps/api/directions/json"), true);
    assert.equal(isDisallowedGoogleServiceUrl("https://routes.googleapis.com/directions/v2:computeRoutes"), true);
    assert.equal(isDisallowedGoogleServiceUrl("https://places.googleapis.com/v1/places:autocomplete"), true);
    assert.equal(
      isDisallowedGoogleServiceUrl("https://maps.googleapis.com/maps/api/js?key=demo&v=weekly"),
      false
    );
  });
});
