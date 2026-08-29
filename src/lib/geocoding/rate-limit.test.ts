import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  enqueueNominatim,
  nominatimMinIntervalMs,
  NOMINATIM_TIMEOUT_MS,
  resetNominatimQueue,
} from "@/lib/geocoding/rate-limit";

afterEach(() => {
  resetNominatimQueue();
});

describe("Nominatim rate limit", () => {
  it("defaults to a 1s interval and 8s timeout", () => {
    resetNominatimQueue();
    assert.equal(nominatimMinIntervalMs(), 1000);
    assert.equal(NOMINATIM_TIMEOUT_MS, 8000);
  });

  it("serializes tasks and still releases after a rejection", async () => {
    resetNominatimQueue({ minIntervalMs: 0, timeoutMs: 200 });
    await assert.rejects(
      () =>
        enqueueNominatim(async () => {
          throw new Error("provider down");
        }),
      /provider down/
    );
    const value = await enqueueNominatim(async () => "ok");
    assert.equal(value, "ok");
  });
});
