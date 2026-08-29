import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseQuickEntry } from "@/lib/team/parse-quick-entry";

describe("parseQuickEntry", () => {
  it("parses suburb, 10am and job type", () => {
    const parsed = parseQuickEntry("Nambour 10am ACM Survey");
    assert.equal(parsed.time, "10:00");
    assert.equal(parsed.title, "ACM Survey");
    assert.equal(parsed.address, "Nambour");
  });

  it("parses dotted times and street addresses", () => {
    const parsed = parseQuickEntry("123 Example St Nambour 10.15am");
    assert.equal(parsed.time, "10:15");
    assert.match(parsed.address, /Nambour/i);
  });

  it("parses 8am without a job type", () => {
    const parsed = parseQuickEntry("Gympie 8am");
    assert.equal(parsed.time, "08:00");
    assert.equal(parsed.address, "Gympie");
  });

  it("parses 1pm", () => {
    assert.equal(parseQuickEntry("Ipswich 1pm Sampling").time, "13:00");
  });

  it("keeps original text when nothing is structured", () => {
    const parsed = parseQuickEntry("follow up Springfield site");
    assert.equal(parsed.time, undefined);
    assert.equal(parsed.address, "follow up Springfield site");
  });
});
