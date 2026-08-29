import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { minutesBeforeWorkingDayEnd } from "@/lib/route-summary";
import {
  resetDayRouteStore,
  useDayRouteStore,
} from "@/lib/store/day-route-store";
import { diagnoseDayRoute } from "@/lib/testing/diagnostics";
import { VALIDATION_SCENARIOS } from "@/lib/testing/validation-scenarios";

afterEach(() => {
  resetDayRouteStore();
});

function noDuplicateMembership(): void {
  const state = useDayRouteStore.getState();
  const routed = new Set(state.plan.stops.map((stop) => stop.jobId));
  for (const job of state.plan.unbookedPool) {
    assert.equal(routed.has(job.id), false, `${job.id} is on the route and in the pool`);
  }
}

describe("validation scenarios", () => {
  for (const scenario of VALIDATION_SCENARIOS) {
    it(`${scenario.id} hydrates and can be diagnosed`, () => {
      const ok = useDayRouteStore.getState().loadScenario(scenario.id);
      assert.equal(ok, true);
      if (!scenario.startOptimised) {
        useDayRouteStore.getState().runOptimise();
      }
      const state = useDayRouteStore.getState();
      const diagnostics = diagnoseDayRoute(state);
      assert.equal(diagnostics.scenarioId, scenario.id);
      assert.ok(diagnostics.jobCount > 0);
      assert.ok(Number.isFinite(diagnostics.totalTravelMinutes));
      noDuplicateMembership();
    });
  }
});

describe("phone-booking workflow", () => {
  const scenarioIds = [
    "simple-corridor",
    "fixed-anchor",
    "after-time",
    "multiple-constraints",
    "inefficient-outlier",
    "overloaded-day",
    "mid-day-addition",
    "alternate-finish",
    "regional-distances",
    "booking-failure",
  ] as const;

  for (const id of scenarioIds) {
    it(`${id}: optimise → constrain → recalculate → confirm → nearby → add → drag → undo → move out`, () => {
      useDayRouteStore.getState().loadScenario(id);
      if (!useDayRouteStore.getState().hasOptimised) {
        useDayRouteStore.getState().runOptimise();
      }
      let state = useDayRouteStore.getState();
      assert.ok(state.plan.stops.length > 0, "route should have stops");
      noDuplicateMembership();

      const target = state.plan.stops.find((stop) => state.jobs[stop.jobId])!;
      state.selectJob(target.jobId, "stop");
      state.updateJobConstraint(target.jobId, { type: "after", time: "11:00" });
      assert.equal(useDayRouteStore.getState().needsRecalculate, true);
      useDayRouteStore.getState().recalculate();
      state = useDayRouteStore.getState();
      assert.equal(state.needsRecalculate, false);
      const afterStop = state.plan.stops.find((stop) => stop.jobId === target.jobId);
      assert.ok(afterStop?.suggestedArrival);

      useDayRouteStore.getState().confirmSuggestedTime(target.jobId);
      assert.equal(useDayRouteStore.getState().jobs[target.jobId].bookingStatus, "confirmed");

      const nearby = useDayRouteStore.getState().getNearbyUnbooked();
      if (nearby.length > 0) {
        const candidate = nearby[0].job;
        const slots = useDayRouteStore.getState().getSlotSuggestionsFor(candidate.id);
        if (slots[0]) {
          useDayRouteStore.getState().applySlotSuggestion(candidate.id, slots[0]);
          assert.equal(
            useDayRouteStore.getState().plan.stops.filter((stop) => stop.jobId === candidate.id)
              .length,
            1
          );
        }
      }

      state = useDayRouteStore.getState();
      if (state.plan.stops.length >= 2) {
        const orderBefore = state.plan.stops.map((stop) => stop.jobId);
        state.reorderStop(0, 1);
        const orderDragged = useDayRouteStore.getState().plan.stops.map((stop) => stop.jobId);
        assert.notDeepEqual(orderDragged, orderBefore);
        useDayRouteStore.getState().undo();
        assert.deepEqual(
          useDayRouteStore.getState().plan.stops.map((stop) => stop.jobId),
          orderBefore
        );
      }

      const moveStop = useDayRouteStore.getState().plan.stops.at(-1);
      assert.ok(moveStop);
      const movedId = moveStop.jobId;
      useDayRouteStore.getState().moveOutOfDay(moveStop.id);
      state = useDayRouteStore.getState();
      assert.equal(state.plan.stops.some((stop) => stop.jobId === movedId), false);
      assert.equal(state.plan.unbookedPool.some((job) => job.id === movedId), true);
      assert.ok(state.jobs[movedId]);
      noDuplicateMembership();
    });
  }
});

describe("overloaded day reporting", () => {
  it("keeps every job and reports working-day overrun", () => {
    useDayRouteStore.getState().loadScenario("overloaded-day");
    useDayRouteStore.getState().runOptimise();
    const state = useDayRouteStore.getState();
    assert.equal(state.plan.stops.length, 10);
    const remaining = minutesBeforeWorkingDayEnd(
      state.plan.settings,
      state.plan.stops,
      state.jobs
    );
    assert.ok(remaining !== null && remaining < 0);
    const diagnostics = diagnoseDayRoute(state);
    assert.ok(diagnostics.minutesBeforeWorkingDayEnd !== null);
    assert.ok(diagnostics.minutesBeforeWorkingDayEnd < 0);
  });
});
