import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampSamplingMinutes,
  samplingDurationOf,
  totalSamplingMinutes,
} from "@/lib/routing/sampling";

describe("sampling duration", () => {
  it("clamps custom values to 5–240 minutes", () => {
    assert.equal(clampSamplingMinutes(1), 5);
    assert.equal(clampSamplingMinutes(400), 240);
    assert.equal(clampSamplingMinutes(22.4), 22);
  });

  it("prefers the job sampling duration over the global default", () => {
    assert.equal(
      samplingDurationOf(
        { samplingDurationMinutes: 45, estimatedMinutes: 20 },
        { visitDurationMinutes: 20 }
      ),
      45
    );
    assert.equal(
      totalSamplingMinutes(
        [{ jobId: "a" }, { jobId: "b" }],
        {
          a: {
            id: "a",
            address: "A",
            estimatedMinutes: 10,
            samplingDurationMinutes: 10,
            constraint: { type: "flexible" },
            bookingStatus: "uncontacted",
          },
          b: {
            id: "b",
            address: "B",
            estimatedMinutes: 30,
            samplingDurationMinutes: 30,
            constraint: { type: "flexible" },
            bookingStatus: "uncontacted",
          },
        }
      ),
      40
    );
  });
});
