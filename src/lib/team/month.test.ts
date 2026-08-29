import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTeamDemo } from "@/lib/team/dummy-data";
import {
  DEMO_MONTH_START,
  monthLabel,
  monthWorkingIsoDates,
  nearestVisibleDate,
  scrollAnchorForMonth,
  shiftMonth,
} from "@/lib/team/month";

describe("month board helpers", () => {
  it("lists August 2026 weekdays without weekends", () => {
    const days = monthWorkingIsoDates(DEMO_MONTH_START, false);
    assert.equal(days[0], "2026-08-03");
    assert.equal(days.at(-1), "2026-08-31");
    assert.equal(days.length, 21);
    assert.equal(days.includes("2026-08-01"), false);
    assert.equal(days.includes("2026-08-02"), false);
    assert.equal(days.includes("2026-08-13"), true);
    assert.equal(monthLabel(DEMO_MONTH_START), "AUGUST 2026");
    assert.equal(shiftMonth(DEMO_MONTH_START, 1), "2026-09-01");
  });

  it("anchors current-month scroll near today rather than the 1st", () => {
    const today = new Date(2026, 7, 18);
    assert.equal(scrollAnchorForMonth("2026-08-01", false, today), "2026-08-18");
    assert.equal(scrollAnchorForMonth("2026-08-01", false, new Date(2026, 7, 29)), "2026-08-28");
    assert.equal(scrollAnchorForMonth("2026-09-01", false, today), "2026-09-01");
    assert.equal(nearestVisibleDate("2026-08-29", monthWorkingIsoDates("2026-08-01", false)), "2026-08-28");
  });

  it("seeds a full-month synthetic board without changing the Sep 3 ranking setup", () => {
    const demo = createTeamDemo();
    assert.ok(demo.consultants.length >= 15);
    assert.ok(demo.allocations.length >= 80);
    const thursday = demo.allocations.filter((item) => item.scheduledDate === "2026-09-03");
    const taylor = thursday
      .filter((item) => item.consultantId === "c-taylor")
      .map((item) => demo.jobs[item.jobId]?.suburb)
      .sort();
    assert.deepEqual(taylor, ["Buderim", "Maroochydore"]);
    assert.equal(demo.jobs["tj-120"]?.suburb, "Nambour");
    assert.equal(
      demo.allocations.some((item) => item.jobId === "tj-120"),
      false
    );
    const taylor12 = demo.allocations.find(
      (item) => item.consultantId === "c-taylor" && item.scheduledDate === "2026-08-12"
    );
    const taylor13 = demo.allocations.find(
      (item) => item.consultantId === "c-taylor" && item.scheduledDate === "2026-08-13"
    );
    assert.equal(demo.jobs[taylor12?.jobId ?? ""]?.suburb, "Nambour");
    assert.equal(demo.jobs[taylor13?.jobId ?? ""]?.suburb, "Maroochydore");
  });
});
