import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addressRegionSuffix,
  streetAndSuburbFromDisplay,
  streetAndSuburbLabel,
} from "@/lib/geocoding/address-label";

describe("street and suburb labels", () => {
  it("keeps the street when Nominatim only stored the city as suburb", () => {
    assert.equal(
      streetAndSuburbFromDisplay("Cork Street, Brisbane QLD 4508", "Brisbane"),
      "Cork Street, Brisbane"
    );
    assert.equal(
      streetAndSuburbFromDisplay("Lavarack Road, Bray Park QLD 4500", "Bray Park"),
      "Lavarack Road, Bray Park"
    );
    assert.equal(
      streetAndSuburbLabel({
        address: "Cork Street, Brisbane QLD 4508",
        suburb: "Brisbane",
        resolvedDisplayAddress: "Cork Street, Brisbane QLD 4508",
      }),
      "Cork Street, Brisbane"
    );
  });

  it("leaves demo addresses that already include the suburb", () => {
    assert.equal(
      streetAndSuburbFromDisplay("12 Example St, Indooroopilly", "Indooroopilly"),
      "12 Example St, Indooroopilly"
    );
  });

  it("splits the postcode onto a secondary line", () => {
    assert.equal(addressRegionSuffix("Cork Street, Brisbane QLD 4508"), "QLD 4508");
    assert.equal(addressRegionSuffix("12 Example St, Indooroopilly"), null);
  });
});
