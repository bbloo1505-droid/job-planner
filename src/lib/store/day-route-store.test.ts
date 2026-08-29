import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { timeToMinutes } from "@/lib/routing/round-time";
import {
  resetDayRouteStore,
  useDayRouteStore,
} from "@/lib/store/day-route-store";
import { isRounded } from "@/lib/testing/assert-route";

afterEach(() => {
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
});
