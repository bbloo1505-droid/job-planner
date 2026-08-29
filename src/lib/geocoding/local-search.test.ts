import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LocalLookupSearchProvider } from "@/lib/geocoding/local-search";
import { mergeResults } from "@/lib/geocoding/search";

describe("local lookup address search", () => {
  it("returns exact demo addresses only, not suburb-centroid guesses", async () => {
    const provider = new LocalLookupSearchProvider();
    const exact = await provider.searchAddress("8 Railway Pde, Darra");
    assert.equal(exact.length, 1);
    assert.equal(exact[0].provider, "local-lookup");
    assert.equal(exact[0].suburb, "Darra");

    const realStreet = await provider.searchAddress(
      "18 Railway Pde, Darra QLD 4076"
    );
    assert.deepEqual(realStreet, []);

    const william = await provider.searchAddress("1 William Street, Brisbane");
    assert.deepEqual(william, []);
  });

  it("merges local and remote results without duplicate coordinates", () => {
    const merged = mergeResults(
      [
        {
          id: "local",
          displayAddress: "Demo",
          latitude: -27.564,
          longitude: 152.9546,
          provider: "local-lookup",
        },
      ],
      [
        {
          id: "remote",
          displayAddress: "Real",
          latitude: -27.564,
          longitude: 152.9546,
          provider: "nominatim",
        },
        {
          id: "other",
          displayAddress: "William St",
          latitude: -27.4676,
          longitude: 153.0281,
          provider: "nominatim",
        },
      ]
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0].id, "local");
    assert.equal(merged[1].id, "other");
  });
});
