import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  geocodeAddress,
  geocodeExactAddress,
  jobHasResolvedLocation,
  normalizeAddressKey,
  resolvedPointOf,
} from "@/lib/geo";

describe("local synthetic address lookup", () => {
  it("normalizes case, punctuation, and street suffixes onto existing keys", () => {
    assert.equal(normalizeAddressKey("8 Railway Pde, Darra"), "8 railway pde darra");
    assert.equal(normalizeAddressKey("8 railway parade darra"), "8 railway pde darra");
    assert.equal(normalizeAddressKey("84 Sample Road, Oxley QLD 4075"), "84 sample rd oxley");
  });

  it("resolves suffix variants to the same synthetic coordinate", () => {
    const canonical = geocodeAddress("8 Railway Pde, Darra");
    const variant = geocodeAddress("8 railway parade darra");
    assert.ok(canonical);
    assert.ok(variant);
    assert.equal(variant.lat, canonical.lat);
    assert.equal(variant.lng, canonical.lng);
    assert.equal(variant.suburb, "Darra");
  });

  it("does not invent coordinates for suburbs outside the local dataset", () => {
    const unknown = geocodeAddress("cork st deception bay");
    assert.equal(unknown, null);
    assert.equal(geocodeAddress("solandar st deception bay"), null);
    assert.equal(geocodeAddress("lavarack road bray park"), null);
    assert.equal(geocodeAddress("saiala ct bray park"), null);
  });

  it("keeps suburb-centroid fallback out of exact address search", () => {
    const hashed = geocodeAddress("18 Railway Pde, Darra QLD 4076");
    assert.ok(hashed);
    assert.equal(hashed.suburb, "Darra");
    assert.equal(geocodeExactAddress("18 Railway Pde, Darra QLD 4076"), null);
    assert.ok(geocodeExactAddress("8 Railway Pde, Darra"));
  });

  it("treats Unknown suburb leftovers as unresolved even if a point exists", () => {
    assert.equal(resolvedPointOf(-27.4698, 153.0251, "Unknown"), null);
    assert.equal(
      jobHasResolvedLocation({
        suburb: "Unknown",
        latitude: -27.4698,
        longitude: 153.0251,
      }),
      false
    );
    assert.equal(
      jobHasResolvedLocation({
        suburb: "Darra",
        latitude: -27.564,
        longitude: 152.9546,
      }),
      true
    );
    assert.equal(
      jobHasResolvedLocation({
        suburb: "Darra",
        latitude: -27.564,
        longitude: 152.9546,
        geocodingStatus: "stale",
      }),
      false
    );
  });
});
