import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WORK_CATEGORIES,
  WORK_CATEGORY_META,
  resolveWorkCategory,
} from "@/lib/team/work-category";

describe("work categories", () => {
  it("covers the QLD planning-board colour language", () => {
    assert.deepEqual(WORK_CATEGORIES, [
      "confirmed_work",
      "proposed_work",
      "reporting",
      "not_available",
      "management_locked",
      "secondary_consultant",
      "meeting",
      "laboratory",
    ]);
    const fills = WORK_CATEGORIES.map((id) => WORK_CATEGORY_META[id].fill);
    assert.equal(new Set(fills).size, fills.length);
    assert.equal(WORK_CATEGORY_META.confirmed_work.fill, "#7FF25C");
    assert.equal(WORK_CATEGORY_META.proposed_work.fill, "#FCFE53");
    assert.equal(WORK_CATEGORY_META.reporting.fill, "#75FBFE");
    assert.equal(WORK_CATEGORY_META.not_available.fill, "#959999");
    assert.equal(WORK_CATEGORY_META.management_locked.fill, "#E23F34");
    assert.equal(WORK_CATEGORY_META.management_locked.text, "#ffffff");
    assert.equal(WORK_CATEGORY_META.secondary_consultant.fill, "#E69736");
    assert.equal(WORK_CATEGORY_META.meeting.fill, "#E934F6");
    assert.equal(WORK_CATEGORY_META.laboratory.fill, "#8D1FF0");
    assert.equal(WORK_CATEGORY_META.laboratory.text, "#ffffff");
    assert.match(
      WORK_CATEGORY_META.management_locked.keyLabel,
      /Do not move without Management Approval/i
    );
    assert.equal(resolveWorkCategory(undefined), "proposed_work");
  });
});
