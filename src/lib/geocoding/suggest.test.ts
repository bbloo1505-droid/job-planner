import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADDRESS_SUGGEST_MIN_CHARS,
  addressSuggestQuery,
} from "@/lib/geocoding/suggest";

describe("address suggest query", () => {
  it("does not search until the typed value is long enough", () => {
    assert.equal(addressSuggestQuery(""), null);
    assert.equal(addressSuggestQuery("12"), null);
    assert.equal(addressSuggestQuery("12 Ex"), null);
    assert.equal("12 Exa".length, ADDRESS_SUGGEST_MIN_CHARS);
    assert.equal(addressSuggestQuery("12 Exa"), "12 Exa");
  });

  it("trims and collapses spaces before searching", () => {
    assert.equal(addressSuggestQuery("  12 Example St  "), "12 Example St");
    assert.equal(addressSuggestQuery("12   Example"), "12 Example");
  });
});
