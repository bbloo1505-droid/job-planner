import { mkdirSync } from "fs";
import { chromium } from "playwright-core";

mkdirSync("tmp", { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3010/team");
await page.locator('[data-testid="planning-board"][data-board-view="month"]').waitFor();
async function showTaylorCoast() {
  await page.locator('[data-date-header="2026-08-13"]').evaluate((node) => {
    node.scrollIntoView({ inline: "center", block: "nearest" });
  });
  await page.waitForTimeout(350);
}

await showTaylorCoast();
await page.screenshot({ path: "tmp/month-1440.png" });
await page.setViewportSize({ width: 1366, height: 768 });
await showTaylorCoast();
await page.screenshot({ path: "tmp/month-1366.png" });
await page.setViewportSize({ width: 1920, height: 1080 });
await showTaylorCoast();
await page.screenshot({ path: "tmp/month-1920.png" });
await page.locator('[data-date-header="2026-08-13"]').click();
await page.locator('[data-view="map"]').click();
await page.locator('[data-testid="geo-map"][data-geo-scope="2026-08-13"]').waitFor({ timeout: 20000 });
await page.locator('[data-view="planner"]').click();
await page.locator('[data-testid="planning-board"][data-board-view="month"]').waitFor();
await page.locator('[data-board-option="week"]').click();
await page.locator('[data-testid="planning-board"][data-board-view="week"]').waitFor();
await page.locator('[data-board-option="month"]').click();
await page.locator('[data-view="split"]').click();
await page.locator('[data-testid="geo-map"]').waitFor();
console.log("MAP_DATE_SYNC_OK");
await browser.close();
console.log("MONTH_SHOTS_OK");
