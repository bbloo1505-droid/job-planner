/**
 * Month board acceptance check.
 * Requires Chrome + playwright-core. MAP_VERIFY_URL defaults to http://localhost:3010
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";

const BASE = process.env.MAP_VERIFY_URL ?? "http://localhost:3010";

async function scrollDate(page, iso) {
  await page.locator(`[data-date-header="${iso}"]`).evaluate((node) => {
    node.scrollIntoView({ inline: "center", block: "nearest" });
  });
}

async function dragJobToCell(page, jobId, consultantId, date) {
  const card = page.locator(`[data-job-id="${jobId}"]`).first();
  await card.scrollIntoViewIfNeeded();
  const start = await card.boundingBox();
  if (!start) throw new Error("Missing drag source");
  await page.mouse.move(start.x + 12, start.y + 8);
  await page.mouse.down();
  await page.mouse.move(start.x + 28, start.y + 12, { steps: 8 });
  await page.locator(`[data-cell="${consultantId}:${date}"]`).evaluate((node) => {
    node.scrollIntoView({ inline: "center", block: "nearest" });
  });
  await page.waitForTimeout(120);
  const drop = page.locator(`[data-cell="${consultantId}:${date}"] [data-testid="quick-add-trigger"]`);
  const box = (await drop.boundingBox()) ?? (await page.locator(`[data-cell="${consultantId}:${date}"]`).boundingBox());
  if (!box) {
    await page.mouse.up();
    throw new Error(`Drop cell ${consultantId}:${date} is not visible`);
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
}

async function main() {
  mkdirSync("tmp", { recursive: true });
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/team`);
  await page.locator('[data-testid="team-planner-app"][data-planner-ready="true"]').waitFor();
  await page.locator('[data-testid="planning-board"][data-board-view="month"]').waitFor();
  await page.getByTestId("planner-period-label").getByText("AUGUST 2026").waitFor();

  const weekdayCount = await page.locator("[data-date-header]").count();
  if (weekdayCount < 20 || weekdayCount > 23) {
    throw new Error(`Expected ~21 August weekdays, got ${weekdayCount}`);
  }
  if ((await page.locator('[data-date-header="2026-08-01"]').count()) !== 0) {
    throw new Error("Saturday 1 Aug should be hidden by default");
  }
  await page.locator('[data-date-header="2026-08-13"]').waitFor();
  await page.locator('[data-consultant-row="c-taylor"]').waitFor();
  await page.screenshot({ path: "tmp/month-1440.png" });

  const nameBox = await page.locator('[data-consultant-row="c-taylor"]').boundingBox();
  await scrollDate(page, "2026-08-28");
  await page.waitForTimeout(250);
  const nameBoxAfter = await page.locator('[data-consultant-row="c-taylor"]').boundingBox();
  if (!nameBox || !nameBoxAfter || Math.abs(nameBox.x - nameBoxAfter.x) > 2) {
    throw new Error("Consultant column did not stay sticky while scrolling");
  }

  await scrollDate(page, "2026-08-13");
  await page.locator('[data-consultant-row="c-taylor"]').scrollIntoViewIfNeeded();
  await page.locator('[data-cell="c-taylor:2026-08-13"] [data-testid="quick-add-trigger"]').click();
  await page.getByLabel("Add job").fill("Nambour 10am ACM Survey");
  await page.getByLabel("Add job").press("Enter");
  const created = page.locator('[data-cell="c-taylor:2026-08-13"] [data-job-id]').last();
  await created.waitFor();
  const createdId = await created.getAttribute("data-job-id");
  if (!createdId) throw new Error("Quick-add did not create a job");

  await dragJobToCell(page, createdId, "c-alex", "2026-08-20");
  await page.locator(`[data-cell="c-alex:2026-08-20"] [data-job-id="${createdId}"]`).waitFor();

  await page.keyboard.press("Control+z");
  await page.locator(`[data-cell="c-taylor:2026-08-13"] [data-job-id="${createdId}"]`).waitFor();

  await page.getByTestId("planner-side-toggle").click();
  const unassigned = page.locator('[data-testid="unassigned-panel"] [data-job-id]').nth(1);
  await unassigned.waitFor();
  const unassignedId = await unassigned.getAttribute("data-job-id");
  await dragJobToCell(page, unassignedId, "c-taylor", "2026-08-25");
  const assigned = page.locator(`[data-cell="c-taylor:2026-08-25"] [data-job-id="${unassignedId}"]`);
  await assigned.waitFor();
  await assigned.click({ button: "right" });
  await page.getByRole("menuitemradio", { name: "Confirmed Work" }).click();
  if ((await assigned.getAttribute("data-work-category")) !== "confirmed_work") {
    throw new Error("Work category did not change to confirmed");
  }

  const jobNo = await page.evaluate((id) => {
    const card = document.querySelector(`[data-job-id="${id}"]`);
    return card?.textContent ?? "";
  }, unassignedId);
  const searchToken = jobNo.match(/PR-TEST-\d+/)?.[0];
  if (searchToken) {
    await page.getByTestId("planner-filters-toggle").click();
    await page.getByTestId("planner-search").fill(searchToken);
    await page.waitForTimeout(200);
    const cell = page.locator(`[data-cell="c-taylor:2026-08-25"] [data-job-id="${unassignedId}"]`);
    await cell.waitFor();
  }

  await page.locator('[data-date-header="2026-08-25"]').click();
  if ((await page.locator('[data-testid="team-planner-app"]').getAttribute("data-selected-date")) !== "2026-08-25") {
    throw new Error("Date header did not select 25 Aug");
  }
  await page.goto(`${BASE}/team/map`);
  await page.locator('[data-testid="geo-map"][data-geo-scope="2026-08-25"]').waitFor();
  await page.goto(`${BASE}/team`);
  await page.locator('[data-testid="planning-board"][data-board-view="month"]').waitFor();

  await page.getByLabel("Next month").click();
  await page.getByTestId("planner-period-label").getByText("SEPTEMBER 2026").waitFor();
  await page.getByLabel("Previous month").click();
  await page.getByTestId("planner-period-label").getByText("AUGUST 2026").waitFor();
  await page.getByTestId("planner-today").click();

  await page.locator('[data-board-option="week"]').click();
  await page.locator('[data-testid="planning-board"][data-board-view="week"]').waitFor();
  await page.locator('[data-board-option="month"]').click();
  await page.locator('[data-testid="planning-board"][data-board-view="month"]').waitFor();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  if (overflow) throw new Error("Page-level horizontal overflow");

  await page.screenshot({ path: "tmp/month-1440.png" });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "tmp/month-1366.png" });
  const nameVisible = await page.locator('[data-consultant-row="c-taylor"]').boundingBox();
  if (!nameVisible || nameVisible.x > 280) throw new Error("Consultant names not visible at 1366");

  await page.goto(`${BASE}/team/map`);
  await page.locator('[data-testid="geo-map"]').waitFor();

  console.log("MONTH_BOARD_E2E_OK");
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
