import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  expandStreetAbbreviations,
  formatNominatimDisplay,
  mapNominatimHit,
  mapNominatimHits,
} from "@/lib/geocoding/nominatim";
import { parseGeocodingProviderKind } from "@/lib/geocoding/provider";

describe("Nominatim result mapping", () => {
  it("maps a public Queensland hit without exposing the raw provider shape", () => {
    const result = mapNominatimHit({
      place_id: 99,
      lat: "-27.5641",
      lon: "152.9547",
      display_name: "18 Railway Parade, Darra, Brisbane, Queensland, 4076, Australia",
      address: {
        suburb: "Darra",
        state: "Queensland",
        postcode: "4076",
        country: "Australia",
        country_code: "au",
      },
    });
    assert.ok(result);
    assert.equal(result.provider, "nominatim");
    assert.equal(result.latitude, -27.5641);
    assert.equal(result.longitude, 152.9547);
    assert.equal(result.suburb, "Darra");
    assert.equal(result.state, "Queensland");
    assert.equal(result.postcode, "4076");
    assert.equal(result.country, "Australia");
    assert.equal("place_id" in result, false);
  });

  it("formats an Australian street address from structured fields", () => {
    const display = formatNominatimDisplay({
      display_name:
        "18, Railway Parade, Darra, Brisbane, Queensland, 4076, Australia",
      address: {
        house_number: "18",
        road: "Railway Parade",
        suburb: "Darra",
        state: "Queensland",
        postcode: "4076",
        country: "Australia",
      },
    });
    assert.equal(display, "18 Railway Parade, Darra QLD 4076");
  });

  it("expands street suffixes without rewriting St Lucia", () => {
    assert.equal(
      expandStreetAbbreviations("18 Railway Pde, Darra QLD 4076"),
      "18 Railway Parade, Darra QLD 4076"
    );
    assert.equal(
      expandStreetAbbreviations("1 William St, Brisbane"),
      "1 William Street, Brisbane"
    );
    assert.equal(expandStreetAbbreviations("St Lucia QLD"), "St Lucia QLD");
  });

  it("drops invalid coordinates and prefers Australian results", () => {
    const results = mapNominatimHits([
      { lat: "bad", lon: "1", display_name: "Invalid" },
      {
        place_id: 1,
        lat: "51.5",
        lon: "-0.1",
        display_name: "London",
        address: { country: "United Kingdom" },
      },
      {
        place_id: 2,
        lat: "-27.5",
        lon: "153.0",
        display_name: "Brisbane",
        address: { country: "Australia", suburb: "Brisbane" },
      },
    ]);
    assert.equal(results[0]?.country, "Australia");
    assert.equal(results.some((item) => item.displayAddress === "Invalid"), false);
  });

  it("defaults the configured provider to Nominatim", () => {
    assert.equal(parseGeocodingProviderKind(undefined), "nominatim");
    assert.equal(parseGeocodingProviderKind("local-lookup"), "local-lookup");
  });
});
