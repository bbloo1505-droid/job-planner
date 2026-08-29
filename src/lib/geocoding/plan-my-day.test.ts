import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@/lib/dummy-data";
import { AddressSearchError } from "@/lib/geocoding/client";
import {
  isStrongAddressMatch,
  parseAddressQuery,
  pickAutoAcceptMatch,
} from "@/lib/geocoding/match-address";
import {
  planDayFromResolvedJobs,
  planMyDayPipeline,
  setPlanDaySearcherForTests,
} from "@/lib/geocoding/plan-my-day";
import { timeToMinutes } from "@/lib/routing/round-time";
import type { GeocodingResult, Job } from "@/lib/types";

afterEach(() => {
  setPlanDaySearcherForTests(null);
});

const ADDRESSES = [
  "12 Example St, Indooroopilly QLD",
  "84 Sample Rd, Oxley QLD",
  "15 Test Ave, Darra QLD",
  "29 House St, Inala QLD",
  "61 Example Rd, Forest Lake QLD",
  "18 Sample Ct, Springfield QLD",
] as const;

function hit(
  query: string,
  lat: number,
  lng: number,
  suburb: string
): GeocodingResult {
  const parsed = parseAddressQuery(query);
  const street = parsed.street ?? "street";
  const number = parsed.houseNumber ?? "1";
  return {
    id: `mock:${suburb}`,
    displayAddress: `${number} ${titleStreet(street)}, ${suburb} QLD`,
    latitude: lat,
    longitude: lng,
    suburb,
    state: "Queensland",
    country: "Australia",
    provider: "mock",
  };
}

function titleStreet(street: string): string {
  return street
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const HITS: Record<string, GeocodingResult> = {
  [ADDRESSES[0]]: hit(ADDRESSES[0], -27.5001, 152.9738, "Indooroopilly"),
  [ADDRESSES[1]]: hit(ADDRESSES[1], -27.5612, 152.9799, "Oxley"),
  [ADDRESSES[2]]: hit(ADDRESSES[2], -27.5664, 152.9511, "Darra"),
  [ADDRESSES[3]]: hit(ADDRESSES[3], -27.5958, 152.9726, "Inala"),
  [ADDRESSES[4]]: hit(ADDRESSES[4], -27.6221, 152.9574, "Forest Lake"),
  [ADDRESSES[5]]: hit(ADDRESSES[5], -27.6571, 152.9204, "Springfield"),
};

function jobAt(index: number, extras: Partial<Job> = {}): Job {
  const address = ADDRESSES[index];
  return {
    id: `job-${index + 1}`,
    address,
    enteredAddress: address,
    estimatedMinutes: extras.samplingDurationMinutes ?? extras.estimatedMinutes ?? 20,
    samplingDurationMinutes: extras.samplingDurationMinutes ?? 20,
    geocodingStatus: "unresolved",
    constraint: extras.constraint ?? { type: "flexible" },
    bookingStatus: "uncontacted",
    ...extras,
  };
}

function mockSearch(
  handler: (
    query: string,
    call: number
  ) => Promise<{ results: GeocodingResult[]; cached: boolean }> | { results: GeocodingResult[]; cached: boolean }
): { search: (query: string) => Promise<{ results: GeocodingResult[]; cached: boolean }>; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    search: async (query) => {
      calls.push(query);
      return handler(query, calls.length);
    },
  };
}

describe("address auto-accept", () => {
  it("parses Australian street, suburb, and postcode", () => {
    const parsed = parseAddressQuery("1 William Street, Brisbane QLD 4000");
    assert.equal(parsed.houseNumber, "1");
    assert.equal(parsed.street, "william st");
    assert.equal(parsed.suburb, "brisbane");
    assert.equal(parsed.postcode, "4000");
  });

  it("reads the suburb from a comma-less Queensland line", () => {
    const parsed = parseAddressQuery("13 cork st deception bay");
    assert.equal(parsed.houseNumber, "13");
    assert.equal(parsed.street, "cork st");
    assert.equal(parsed.suburb, "deception bay");
  });

  it("auto-accepts the Brisbane match and rejects other William Streets", () => {
    const query = "1 William Street, Brisbane QLD";
    const brisbane: GeocodingResult = {
      id: "b",
      displayAddress: "1 William Street, Brisbane City QLD 4000",
      latitude: -27.475,
      longitude: 153.026,
      suburb: "Brisbane City",
      postcode: "4000",
      country: "Australia",
      provider: "mock",
    };
    const goodna: GeocodingResult = {
      id: "g",
      displayAddress: "1 William Street, Goodna QLD 4300",
      latitude: -27.607,
      longitude: 152.896,
      suburb: "Goodna",
      postcode: "4300",
      country: "Australia",
      provider: "mock",
    };
    assert.equal(isStrongAddressMatch(query, brisbane), true);
    assert.equal(isStrongAddressMatch(query, goodna), false);
    assert.equal(pickAutoAcceptMatch(query, [brisbane, goodna])?.id, "b");
  });

  it("does not guess when two strong matches remain", () => {
    const query = "1 William Street";
    const a = hit("1 William Street, Brisbane QLD", -27.47, 153.02, "Brisbane City");
    const b = hit("1 William Street, Goodna QLD", -27.6, 152.89, "Goodna");
    assert.equal(pickAutoAcceptMatch(query, [a, b]), null);
  });
});

describe("Plan my day pipeline", () => {
  it("A. resolves six addresses and generates a route", async () => {
    const { search, calls } = mockSearch((query) => ({
      results: [HITS[query]],
      cached: false,
    }));
    const result = await planMyDayPipeline({
      jobs: ADDRESSES.map((_, index) => jobAt(index)),
      settings: DEFAULT_SETTINGS,
      search,
    });
    assert.equal(calls.length, 6);
    assert.equal(result.routedJobs.length, 6);
    assert.equal(result.unlocatedJobs.length, 0);
    assert.ok(result.optimisation);
    assert.equal(result.optimisation.stops.length, 6);
    for (const stop of result.optimisation.stops) {
      assert.ok(stop.suggestedArrival);
      assert.notEqual(stop.travelMinutesFromPrevious, 0);
    }
  });

  it("B. continues resolving after address 3 times out", async () => {
    const { search, calls } = mockSearch(async (query, call) => {
      if (call === 3) throw new AddressSearchError("timeout");
      return { results: [HITS[query]], cached: false };
    });
    let maxInflight = 0;
    let inflight = 0;
    const sequential: typeof search = async (query) => {
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      try {
        return await search(query);
      } finally {
        inflight -= 1;
      }
    };
    const result = await planMyDayPipeline({
      jobs: ADDRESSES.map((_, index) => jobAt(index)),
      settings: DEFAULT_SETTINGS,
      search: sequential,
    });
    assert.equal(calls.length, 6);
    assert.equal(maxInflight, 1);
    assert.equal(result.jobs[2].geocodingStatus, "not_found");
    assert.equal(result.routedJobs.length, 5);
    assert.equal(result.unlocatedJobs.length, 1);
    assert.equal(result.unlocatedJobs[0].id, "job-3");
  });

  it("C. still generates a five-stop route when 5 of 6 resolve", async () => {
    const { search } = mockSearch(async (query, call) => {
      if (call === 6) return { results: [], cached: false };
      return { results: [HITS[query]], cached: false };
    });
    const result = await planMyDayPipeline({
      jobs: ADDRESSES.map((_, index) => jobAt(index)),
      settings: DEFAULT_SETTINGS,
      search,
    });
    assert.equal(result.routedJobs.length, 5);
    assert.equal(result.optimisation?.stops.length, 5);
    assert.equal(result.unlocatedJobs[0]?.id, "job-6");
  });

  it("D. cached / already-resolved addresses skip the network search", async () => {
    const confirmed = jobAt(0, {
      geocodingStatus: "confirmed",
      suburb: "Indooroopilly",
      latitude: -27.5001,
      longitude: 152.9738,
      resolvedDisplayAddress: "12 Example St, Indooroopilly",
    });
    const { search, calls } = mockSearch(() => {
      throw new Error("network should not be used for cached jobs");
    });
    const result = await planMyDayPipeline({
      jobs: [confirmed, jobAt(1)],
      settings: DEFAULT_SETTINGS,
      search: async (query) => {
        if (query === confirmed.address) {
          throw new Error("confirmed job searched the network");
        }
        return search(query).catch(() => ({
          results: [HITS[query]],
          cached: false,
        }));
      },
    });
    assert.equal(calls.length, 1);
    assert.equal(result.routedJobs.length, 2);
  });

  it("E. sampling duration shifts later booking times", () => {
    const shortFirst = planDayFromResolvedJobs({
      jobs: [
        confirmedJob(0, { samplingDurationMinutes: 15 }),
        confirmedJob(1, { samplingDurationMinutes: 20 }),
      ],
      settings: DEFAULT_SETTINGS,
      preserveOrder: true,
    });
    const longFirst = planDayFromResolvedJobs({
      jobs: [
        confirmedJob(0, { samplingDurationMinutes: 45 }),
        confirmedJob(1, { samplingDurationMinutes: 20 }),
      ],
      settings: DEFAULT_SETTINGS,
      preserveOrder: true,
    });
    const shortArrival = shortFirst.optimisation.stops[1]?.suggestedArrival;
    const longArrival = longFirst.optimisation.stops[1]?.suggestedArrival;
    assert.ok(shortArrival);
    assert.ok(longArrival);
    assert.ok(timeToMinutes(longArrival) > timeToMinutes(shortArrival));
  });

  it("F. keeps a fixed appointment at the locked time", () => {
    const result = planDayFromResolvedJobs({
      jobs: [
        confirmedJob(0),
        confirmedJob(1, { constraint: { type: "fixed", time: "10:00" } }),
        confirmedJob(2),
      ],
      settings: DEFAULT_SETTINGS,
    });
    const fixed = result.optimisation.stops.find((stop) => stop.jobId === "job-2");
    assert.equal(fixed?.suggestedArrival, "10:00");
  });

  it("G. unresolved endpoints never produce a fake 0 min drive", async () => {
    const { search } = mockSearch(async (query, call) => {
      if (call === 1) return { results: [], cached: false };
      return { results: [HITS[query]], cached: false };
    });
    const result = await planMyDayPipeline({
      jobs: [jobAt(0), jobAt(1), jobAt(2)],
      settings: DEFAULT_SETTINGS,
      search,
    });
    assert.equal(result.unlocatedJobs.length, 1);
    for (const stop of result.optimisation?.stops ?? []) {
      assert.notEqual(stop.travelMinutesFromPrevious, 0);
      assert.equal(typeof stop.travelMinutesFromPrevious, "number");
    }
    const mixed = planDayFromResolvedJobs({
      jobs: [
        jobAt(0),
        confirmedJob(1),
      ],
      settings: DEFAULT_SETTINGS,
    });
    const unresolvedStop = mixed.optimisation.stops.find(
      (stop) => stop.jobId === "job-1"
    );
    assert.equal(unresolvedStop, undefined);
    assert.equal(mixed.routedJobs.length, 1);
  });
});

function confirmedJob(index: number, extras: Partial<Job> = {}): Job {
  const base = jobAt(index, extras);
  const result = HITS[base.address];
  return {
    ...base,
    suburb: result.suburb,
    latitude: result.latitude,
    longitude: result.longitude,
    resolvedDisplayAddress: result.displayAddress,
    geocodingStatus: "confirmed",
  };
}
