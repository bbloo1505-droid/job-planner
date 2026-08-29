import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { serverGeocodeCache } from "@/lib/geocoding/cache";
import {
  NominatimSearchProvider,
  setNominatimFetcherForTests,
} from "@/lib/geocoding/nominatim";
import {
  enqueueNominatim,
  NominatimTimeoutError,
  resetNominatimQueue,
} from "@/lib/geocoding/rate-limit";
import { searchAddresses } from "@/lib/geocoding/search";

const williamHits = [
  {
    place_id: 1,
    lat: "-27.4751264",
    lon: "153.0258289",
    display_name: "1 William Street, Brisbane City",
    address: {
      house_number: "1",
      road: "William Street",
      suburb: "Brisbane City",
      state: "Queensland",
      postcode: "4000",
      country: "Australia",
      country_code: "au",
    },
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function blockedLiveFetch(): Promise<Response> {
  throw new Error("live Nominatim blocked in tests");
}

describe("Nominatim request queue", () => {
  const provider = new NominatimSearchProvider();

  beforeEach(() => {
    resetNominatimQueue({ minIntervalMs: 0, timeoutMs: 40 });
    serverGeocodeCache.clear();
    setNominatimFetcherForTests(blockedLiveFetch);
  });

  afterEach(async () => {
    setNominatimFetcherForTests(null);
    resetNominatimQueue();
    serverGeocodeCache.clear();
    await new Promise((resolve) => setImmediate(resolve));
  });

  it("A. maps a successful mocked response", async () => {
    setNominatimFetcherForTests(async () => jsonResponse(williamHits));
    const results = await provider.searchAddress("1 William Street, Brisbane");
    assert.equal(results.length, 1);
    assert.equal(results[0].suburb, "Brisbane City");
    assert.equal(results[0].provider, "nominatim");
    assert.equal(results[0].latitude, -27.4751264);
  });

  it("B. times out after the configured duration", async () => {
    setNominatimFetcherForTests(
      (_url, init) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        })
    );
    const started = Date.now();
    await assert.rejects(
      () => provider.searchAddress("timeout-street"),
      NominatimTimeoutError
    );
    assert.ok(Date.now() - started < 200);
  });

  it("C. surfaces an HTTP error", async () => {
    setNominatimFetcherForTests(async () => jsonResponse({ error: "fail" }, 500));
    await assert.rejects(
      () => provider.searchAddress("http-error-street"),
      /Nominatim returned 500/
    );
  });

  it("D. rejects a malformed response", async () => {
    setNominatimFetcherForTests(async () => jsonResponse({ not: "an array" }));
    await assert.rejects(
      () => provider.searchAddress("malformed-street"),
      /malformed/
    );
  });

  it("E. continues with request B after request A times out", async () => {
    let calls = 0;
    setNominatimFetcherForTests(async (_url, init) => {
      calls += 1;
      if (calls === 1) {
        return new Promise((_, reject) => {
          init.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      }
      return jsonResponse(williamHits);
    });
    await assert.rejects(
      () => provider.searchAddress("first-hangs"),
      NominatimTimeoutError
    );
    const results = await provider.searchAddress("1 William Street, Brisbane");
    assert.equal(results[0]?.suburb, "Brisbane City");
    assert.equal(calls, 2);
  });

  it("F. deduplicates identical in-flight searches", async () => {
    let calls = 0;
    let release!: (value: Response) => void;
    setNominatimFetcherForTests(
      () =>
        new Promise((resolve) => {
          calls += 1;
          release = resolve;
        })
    );
    const first = provider.searchAddress("1 William Street, Brisbane");
    const second = provider.searchAddress("  1 william street,  brisbane  ");
    const waitUntil = Date.now() + 100;
    while (calls === 0 && Date.now() < waitUntil) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    assert.equal(calls, 1);
    release(jsonResponse(williamHits));
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a[0]?.id, b[0]?.id);
    assert.equal(calls, 1);
  });

  it("G. cached lookup bypasses the queue and network", async () => {
    serverGeocodeCache.set("1 William Street, Brisbane", [
      {
        id: "cached",
        displayAddress: "1 William Street, Brisbane City QLD 4000",
        latitude: -27.475,
        longitude: 153.026,
        provider: "nominatim",
      },
    ]);
    setNominatimFetcherForTests(blockedLiveFetch);
    const result = await searchAddresses("  1 william street, brisbane  ");
    assert.equal(result.cached, true);
    assert.equal(result.results[0]?.id, "cached");
  });

  it("H. respects the minimum request interval", async () => {
    resetNominatimQueue({ minIntervalMs: 40, timeoutMs: 400 });
    const started: number[] = [];
    const first = enqueueNominatim(async () => {
      started.push(Date.now());
      return 1;
    });
    const second = enqueueNominatim(async () => {
      started.push(Date.now());
      return 2;
    });
    assert.deepEqual(await Promise.all([first, second]), [1, 2]);
    assert.ok(started[1] - started[0] >= 35);
  });
});
