import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  allocationForJob,
  resetTeamPlannerStore,
  unassignedJobs,
  useTeamPlannerStore,
} from "@/lib/store/team-planner-store";

afterEach(() => {
  resetTeamPlannerStore();
});

describe("team planner store", () => {
  it("creates a quick job on Alex / Tuesday and supports move, undo, unassigned", () => {
    const store = useTeamPlannerStore.getState();
    const id = store.quickAdd("c-alex", "2026-09-01", "Nambour 10am ACM Survey");
    assert.ok(id);
    let state = useTeamPlannerStore.getState();
    const job = state.jobs[id];
    assert.equal(job.title, "ACM Survey");
    assert.equal(job.suburb, "Nambour");
    assert.equal(job.workCategory, "proposed_work");
    const created = allocationForJob(state, id);
    assert.equal(created?.consultantId, "c-alex");
    assert.equal(created?.scheduledDate, "2026-09-01");
    assert.equal(created?.startTime, "10:00");

    store.moveAllocation(created!.id, "c-taylor", "2026-09-03");
    state = useTeamPlannerStore.getState();
    assert.equal(allocationForJob(state, id)?.consultantId, "c-taylor");
    assert.equal(allocationForJob(state, id)?.scheduledDate, "2026-09-03");

    store.undo();
    state = useTeamPlannerStore.getState();
    assert.equal(allocationForJob(state, id)?.consultantId, "c-alex");
    assert.equal(allocationForJob(state, id)?.scheduledDate, "2026-09-01");

    const gympie = Object.values(state.jobs).find((item) => item.suburb === "Gympie");
    assert.ok(gympie);
    assert.equal(
      unassignedJobs(state).some((item) => item.id === gympie.id),
      true
    );
    store.assignJob(gympie.id, "c-alex", "2026-09-02");
    store.updateJob(gympie.id, { priority: "high", dueDate: "2026-09-04" });
    state = useTeamPlannerStore.getState();
    assert.equal(state.jobs[gympie.id].priority, "high");
    assert.equal(allocationForJob(state, gympie.id)?.consultantId, "c-alex");

    store.unassignJob(gympie.id);
    state = useTeamPlannerStore.getState();
    assert.equal(allocationForJob(state, gympie.id), undefined);
    assert.equal(
      unassignedJobs(state).some((item) => item.id === gympie.id),
      true
    );
    assert.equal(state.weekStart, "2026-08-31");
  });

  it("assigns Nambour from geographic ranking and undoes back to unassigned", () => {
    const store = useTeamPlannerStore.getState();
    const nambour = store.jobs["tj-120"];
    assert.equal(
      unassignedJobs(store).some((item) => item.id === nambour.id),
      true
    );
    store.assignJob(nambour.id, "c-taylor", "2026-09-03");
    let state = useTeamPlannerStore.getState();
    const allocation = allocationForJob(state, nambour.id);
    assert.equal(allocation?.consultantId, "c-taylor");
    assert.equal(allocation?.scheduledDate, "2026-09-03");
    assert.equal(
      unassignedJobs(state).some((item) => item.id === nambour.id),
      false
    );
    store.undo();
    state = useTeamPlannerStore.getState();
    assert.equal(allocationForJob(state, nambour.id), undefined);
    assert.equal(
      unassignedJobs(state).some((item) => item.id === nambour.id),
      true
    );
  });

  it("changes work category independently of priority and job type", () => {
    const store = useTeamPlannerStore.getState();
    const jobId = "tj-100";
    assert.equal(store.jobs[jobId].workCategory, "confirmed_work");
    assert.equal(store.jobs[jobId].title, "ACM Survey");
    store.updateJob(jobId, { workCategory: "management_locked" });
    let state = useTeamPlannerStore.getState();
    assert.equal(state.jobs[jobId].workCategory, "management_locked");
    assert.equal(state.jobs[jobId].title, "ACM Survey");
    assert.equal(state.jobs[jobId].priority, "normal");
    store.undo();
    state = useTeamPlannerStore.getState();
    assert.equal(state.jobs[jobId].workCategory, "confirmed_work");
  });

  it("navigates months without mutating job dates", () => {
    const store = useTeamPlannerStore.getState();
    assert.equal(store.boardView, "month");
    assert.equal(store.monthStart, "2026-08-01");
    const before = store.allocations.find((item) => item.id === "al-206");
    assert.equal(before?.scheduledDate, "2026-08-13");
    store.selectJob("tj-206");
    store.goMonth(1);
    let state = useTeamPlannerStore.getState();
    assert.equal(state.monthStart, "2026-09-01");
    assert.equal(state.selectedJobId, null);
    assert.equal(
      state.allocations.find((item) => item.id === "al-206")?.scheduledDate,
      "2026-08-13"
    );
    store.goMonth(-1);
    state = useTeamPlannerStore.getState();
    assert.equal(state.monthStart, "2026-08-01");
    store.selectDate("2026-08-25");
    state = useTeamPlannerStore.getState();
    assert.equal(state.selectedDate, "2026-08-25");
    assert.equal(state.weekStart, "2026-08-24");
    assert.equal(state.geoScope, "2026-08-25");
  });

  it("reveals a scheduled job month and date without mutating the allocation", () => {
    const store = useTeamPlannerStore.getState();
    store.goMonth(1);
    store.revealDate("2026-08-25", { consultantId: "c-taylor", jobId: "tj-223" });
    const state = useTeamPlannerStore.getState();
    assert.equal(state.monthStart, "2026-08-01");
    assert.equal(state.selectedDate, "2026-08-25");
    assert.equal(state.weekStart, "2026-08-24");
    assert.equal(state.selectedJobId, "tj-223");
    assert.equal(state.geoScope, "2026-08-25");
    assert.equal(state.focusTarget?.date, "2026-08-25");
    assert.equal(
      state.allocations.find((item) => item.jobId === "tj-223")?.scheduledDate,
      "2026-08-25"
    );
  });

  it("keeps jobs when allocations are removed", () => {
    const jobId = "tj-100";
    const allocation = useTeamPlannerStore
      .getState()
      .allocations.find((item) => item.jobId === jobId);
    assert.ok(allocation);
    useTeamPlannerStore.getState().unassign(allocation.id);
    const state = useTeamPlannerStore.getState();
    assert.ok(state.jobs[jobId]);
    assert.equal(allocationForJob(state, jobId), undefined);
  });
});
