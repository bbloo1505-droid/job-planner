import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GeocodeResultCache } from "@/lib/geocoding/cache";
import { normalizeGeocodeQuery } from "@/lib/geocoding/provider";

describe("geocode cache", () => {
  it("normalizes query keys and returns a copy", () => {
    assert.equal(normalizeGeocodeQuery("  18  Railway   Pde  "), "18 railway pde");
    const cache = new GeocodeResultCache();
    cache.set("18 Railway Pde", [
      {
        id: "1",
        displayAddress: "18 Railway Parade, Darra",
        latitude: -27.56,
        longitude: 152.95,
        provider: "nominatim",
      },
    ]);
    const hit = cache.get("18   railway   pde");
    assert.ok(hit);
    assert.equal(hit[0].displayAddress, "18 Railway Parade, Darra");
    hit[0].displayAddress = "mutated";
    assert.equal(cache.get("18 railway pde")?.[0].displayAddress, "18 Railway Parade, Darra");
  });
});
