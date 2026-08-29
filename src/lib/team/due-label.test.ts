import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dueStateLabel } from "@/lib/team/due-label";

describe("dueStateLabel", () => {
  it("uses the planner week for Due Thu / Due Fri while keeping Due today", () => {
    const today = new Date(2026, 7, 29);
    assert.equal(dueStateLabel("2026-08-29", today, "2026-08-31"), "Due today");
    assert.equal(dueStateLabel("2026-09-03", today, "2026-08-31"), "Due Thu");
    assert.equal(dueStateLabel("2026-09-04", today, "2026-08-31"), "Due Fri");
    assert.equal(dueStateLabel("2026-08-20", today, "2026-08-31"), "Overdue");
  });
});
