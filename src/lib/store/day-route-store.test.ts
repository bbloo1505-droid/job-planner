import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { timeToMinutes } from "@/lib/routing/round-time";
import { setPlanDaySearcherForTests } from "@/lib/geocoding/plan-my-day";
import {
  resetDayRouteStore,
  useDayRouteStore,
} from "@/lib/store/day-route-store";
import { isRounded } from "@/lib/testing/assert-route";

afterEach(() => {
  setPlanDaySearcherForTests(null);
  resetDayRouteStore();
});

describe("day route store hardening", () => {
  it("retains manual order until explicit re-optimisation", () => {
    const store = useDayRouteStore.getState();
    store.loadScenario("simple-corridor");
    useDayRouteStore.getState().runOptimise();
    const before = useDayRouteStore.getState().plan.stops.map((stop) => stop.jobId);
    useDayRouteStore.getState().reorderStop(0, before.length - 1);
    const afterDrag = useDayRouteStore.getState().plan.stops.map((stop) => stop.jobId);
    assert.equal(afterDrag[afterDrag.length - 1], before[0]);
    assert.equal(useDayRouteStore.getState().manualOrderLock, true);
    useDayRouteStore.getState().recalculate();
    const afterRecalc = useDayRouteStore
      .getState()
      .plan.stops.map((stop) => stop.jobId);
    assert.deepEqual(afterRecalc, afterDrag);
  });

  it("recalculates later appointment times after removing a stop", () => {
    useDayRouteStore.getState().loadScenario("simple-corridor");
    useDayRouteStore.getState().runOptimise();
    const firstId = useDayRouteStore.getState().plan.stops[0].id;
    const laterBefore = useDayRouteStore.getState().plan.stops[1]?.suggestedArrival;
    useDayRouteStore.getState().moveOutOfDay(firstId);
    const laterAfter = useDayRouteStore.getState().plan.stops[0]?.suggestedArrival;
    assert.ok(laterBefore);
    assert.ok(laterAfter);
    assert.ok(timeToMinutes(laterAfter) <= timeToMinutes(laterBefore));
  });

  it("moves a stop out of the day without deleting the job", () => {
    useDayRouteStore.getState().loadScenario("booking-failure");
    const stop = useDayRouteStore
      .getState()
      .plan.stops.find((item) => item.jobId === "c-darra");
    assert.ok(stop);
    const jobId = stop.jobId;
    useDayRouteStore.getState().moveOutOfDay(stop.id);
    const state = useDayRouteStore.getState();
    assert.ok(state.jobs[jobId]);
    assert.equal(state.plan.stops.some((item) => item.jobId === jobId), false);
    assert.equal(state.plan.unbookedPool.some((job) => job.id === jobId), true);
    assert.equal(
      state.plan.unbookedPool.filter((job) => job.id === jobId).length,
      1
    );
    const nearby = state.getNearbyUnbooked();
    assert.equal(nearby.some((match) => match.job.id === jobId), true);
  });

  it("undo restores the prior route after move out of day", () => {
    useDayRouteStore.getState().loadScenario("booking-failure");
    const before = structuredClone(useDayRouteStore.getState().plan.stops);
    const stop = useDayRouteStore.getState().plan.stops[2];
    useDayRouteStore.getState().moveOutOfDay(stop.id);
    useDayRouteStore.getState().undo();
    const after = useDayRouteStore.getState().plan.stops.map((item) => item.jobId);
    assert.deepEqual(after, before.map((item) => item.jobId));
  });

  it("adds a slot suggestion once, not twice", () => {
    useDayRouteStore.getState().loadScenario("mid-day-addition");
    const job = useDayRouteStore.getState().plan.unbookedPool[0];
    const [best] = useDayRouteStore.getState().getSlotSuggestionsFor(job.id);
    assert.ok(best);
    useDayRouteStore.getState().applySlotSuggestion(job.id, best);
    useDayRouteStore.getState().applySlotSuggestion(job.id, best);
    const count = useDayRouteStore
      .getState()
      .plan.stops.filter((stop) => stop.jobId === job.id).length;
    assert.equal(count, 1);
    assert.equal(
      useDayRouteStore.getState().plan.unbookedPool.some((item) => item.id === job.id),
      false
    );
  });

  it("returns an added opportunity to the pool on undo", () => {
    useDayRouteStore.getState().loadScenario("mid-day-addition");
    const job = useDayRouteStore.getState().plan.unbookedPool[0];
    const [best] = useDayRouteStore.getState().getSlotSuggestionsFor(job.id);
    useDayRouteStore.getState().applySlotSuggestion(job.id, best);
    useDayRouteStore.getState().undo();
    const state = useDayRouteStore.getState();
    assert.equal(state.plan.stops.some((stop) => stop.jobId === job.id), false);
    assert.equal(state.plan.unbookedPool.some((item) => item.id === job.id), true);
  });

  it("keeps confirmed times rounded after confirm", () => {
    useDayRouteStore.getState().loadScenario("simple-corridor");
    useDayRouteStore.getState().runOptimise();
    const jobId = useDayRouteStore.getState().plan.stops[0].jobId;
    useDayRouteStore.getState().confirmSuggestedTime(jobId);
    const stop = useDayRouteStore.getState().plan.stops.find((item) => item.jobId === jobId);
    const job = useDayRouteStore.getState().jobs[jobId];
    assert.equal(job.bookingStatus, "confirmed");
    assert.equal(job.constraint.type, "fixed");
    assert.ok(stop?.suggestedArrival);
    assert.equal(
      isRounded(stop.suggestedArrival, useDayRouteStore.getState().plan.settings.roundToMinutes),
      true
    );
  });

  it("does not place the same job in both route and pool", () => {
    useDayRouteStore.getState().loadScenario("mid-day-addition");
    const job = useDayRouteStore.getState().plan.unbookedPool[0];
    const [best] = useDayRouteStore.getState().getSlotSuggestionsFor(job.id);
    useDayRouteStore.getState().applySlotSuggestion(job.id, best);
    const state = useDayRouteStore.getState();
    const routed = new Set(state.plan.stops.map((stop) => stop.jobId));
    for (const item of state.plan.unbookedPool) {
      assert.equal(routed.has(item.id), false);
    }
  });

  it("does not invent coordinates or zero-minute travel for unresolved addresses", () => {
    const id = useDayRouteStore.getState().addPendingAddress();
    useDayRouteStore.getState().updatePendingJob(id, "cork st deception bay");
    const job = useDayRouteStore.getState().jobs[id];
    assert.equal(job.address, "cork st deception bay");
    assert.equal(job.latitude, undefined);
    assert.equal(job.longitude, undefined);
    assert.notEqual(job.suburb, "Unknown");
    useDayRouteStore.getState().addStop(id);
    const stop = useDayRouteStore.getState().plan.stops.find((item) => item.jobId === id);
    assert.ok(stop);
    assert.equal(stop.travelMinutesFromPrevious, undefined);
  });

  it("keeps typed spaces while editing a pending address", () => {
    const id = useDayRouteStore.getState().addPendingAddress();
    assert.ok(id);
    useDayRouteStore.getState().updatePendingJob(id, "12 ");
    assert.equal(useDayRouteStore.getState().jobs[id].address, "12 ");
    useDayRouteStore.getState().updatePendingJob(id, "12 Example St, Indooroopilly");
    const job = useDayRouteStore.getState().jobs[id];
    assert.equal(job.address, "12 Example St, Indooroopilly");
    assert.equal(job.latitude, undefined);
    assert.equal(job.geocodingStatus, "unresolved");
  });

  it("confirms a selected geocode result and does not keep stale coordinates", () => {
    const id = useDayRouteStore.getState().addPendingAddress();
    useDayRouteStore.getState().updatePendingJob(id, "18 Railway Pde, Darra");
    useDayRouteStore.getState().confirmGeocodedAddress(id, {
      id: "test-darra",
      displayAddress: "18 Railway Parade, Darra QLD 4076",
      latitude: -27.564,
      longitude: 152.9546,
      suburb: "Darra",
      state: "Queensland",
      country: "Australia",
      provider: "nominatim",
    });
    const confirmed = useDayRouteStore.getState().jobs[id];
    assert.equal(confirmed.geocodingStatus, "confirmed");
    assert.equal(confirmed.latitude, -27.564);
    useDayRouteStore.getState().updatePendingJob(id, "something else entirely");
    const stale = useDayRouteStore.getState().jobs[id];
    assert.equal(stale.geocodingStatus, "stale");
    assert.equal(stale.latitude, undefined);
    assert.equal(stale.longitude, undefined);
  });

  it("shifts later appointment times when sampling duration increases", () => {
    useDayRouteStore.getState().loadScenario("simple-corridor");
    useDayRouteStore.getState().runOptimise();
    const second = useDayRouteStore.getState().plan.stops[1];
    assert.ok(second);
    const before = second.suggestedArrival;
    const firstId = useDayRouteStore.getState().plan.stops[0].jobId;
    useDayRouteStore.getState().updateSamplingDuration(firstId, 45);
    const after = useDayRouteStore.getState().plan.stops[1]?.suggestedArrival;
    assert.ok(before);
    assert.ok(after);
    assert.ok(timeToMinutes(after) >= timeToMinutes(before));
    assert.match(
      useDayRouteStore.getState().impactMessage ?? "",
      /duration changed from \d+ to 45 min/
    );
  });

  it("does not invent start coordinates for a real typed address", () => {
    const before = useDayRouteStore.getState().plan.settings.startLat;
    assert.ok(before);
    useDayRouteStore.getState().updateSettings({
      startLocation: "1 William Street, Brisbane",
    });
    const settings = useDayRouteStore.getState().plan.settings;
    assert.equal(settings.startLocation, "1 William Street, Brisbane");
    assert.equal(settings.startLat, undefined);
    assert.equal(settings.startLng, undefined);
    useDayRouteStore.getState().confirmPlanLocation("start", {
      id: "test-william",
      displayAddress: "1 William Street, Brisbane QLD 4000",
      latitude: -27.4676,
      longitude: 153.0281,
      suburb: "Brisbane City",
      state: "Queensland",
      country: "Australia",
      provider: "nominatim",
    });
    const confirmed = useDayRouteStore.getState().plan.settings;
    assert.equal(confirmed.startLocation, "1 William Street, Brisbane QLD 4000");
    assert.equal(confirmed.startLat, -27.4676);
    assert.equal(confirmed.startLng, 153.0281);
  });

  it("plans confirmed demo properties without calling the geocoder", async () => {
    setPlanDaySearcherForTests(async () => {
      throw new Error("confirmed demo addresses must not hit the geocoder");
    });
    await useDayRouteStore.getState().planMyDay();
    const state = useDayRouteStore.getState();
    assert.equal(state.hasOptimised, true);
    assert.equal(state.plan.stops.length, 6);
    assert.equal(state.unlocatedJobIds.length, 0);
    assert.ok(state.plan.stops[0]?.suggestedArrival);
  });
});
