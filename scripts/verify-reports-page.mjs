import { chromium } from "playwright-core";

const BASE = process.env.REPORTS_VERIFY_URL ?? "http://localhost:3010";

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(60000);

  await page.goto(`${BASE}/reports`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-page='reports'][data-client='ready']").waitFor({ timeout: 60000 });
  await page.getByRole("heading", { name: "Reports & Analytics" }).waitFor();

  const reportsNav = page.locator("[data-nav='/reports']").first();
  const aria = await reportsNav.getAttribute("aria-current");
  const weekTotal = Number(await page.locator("[data-kpi='Total Jobs']").innerText());
  const scheduled = await page.locator("[data-kpi='Scheduled Jobs']").innerText();
  const unassigned = await page.locator("[data-kpi='Unassigned Jobs']").innerText();
  const atRisk = await page.locator("[data-kpi='At-Risk Jobs']").innerText();
  const travel = await page.locator("[data-kpi='travel-saved']").innerText();
  const travelTime = await page.locator("[data-kpi='travel-time']").innerText();
  const body = await page.locator("[data-page='reports']").innerText();

  const periodSelect = page.locator("[data-testid='report-period']");
  await periodSelect.selectOption("month");
  await page.locator("[data-page='reports'][data-period='month']").waitFor();
  const monthTotal = Number(await page.locator("[data-kpi='Total Jobs']").innerText());
  await periodSelect.selectOption("all");
  await page.locator("[data-page='reports'][data-period='all']").waitFor();
  const allTotal = Number(await page.locator("[data-kpi='Total Jobs']").innerText());

  await page.goto(`${BASE}/team`, { waitUntil: "domcontentloaded" });
  const teamHasReports = await page.locator("[data-nav='/reports']").first().isVisible();

  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const homeHasReports = await page.locator("[data-nav='/reports']").first().isVisible();
  const homeNavCurrent = await page.locator("[data-nav='/']").first().getAttribute("aria-current");

  await page.goto(`${BASE}/team/map`, { waitUntil: "domcontentloaded" });
  const mapHasReports = await page.locator("[data-nav='/reports']").first().isVisible();

  const result = {
    reportsNavCurrent: aria,
    week: { total: weekTotal, scheduled, unassigned, atRisk, travel, travelTime },
    monthTotal,
    allTotal,
    hasPriority: /Jobs by Priority/.test(body),
    hasStatus: /Jobs by Status/.test(body),
    hasLocations: /Top Locations/.test(body),
    teamHasReports,
    homeHasReports,
    homeNavCurrent,
    mapHasReports,
  };
  console.log(JSON.stringify(result, null, 2));

  if (aria !== "page") throw new Error("Reports nav not current");
  if (!(weekTotal > 0)) throw new Error("Week total missing");
  if (!(monthTotal > weekTotal)) throw new Error("Month should include extra August jobs");
  if (!(allTotal >= monthTotal)) throw new Error("All should be >= month");
  if (!result.hasPriority || !result.hasStatus || !result.hasLocations) {
    throw new Error("Dashboard cards missing");
  }
  if (!teamHasReports || !homeHasReports || !mapHasReports) {
    throw new Error("Reports link missing on another page");
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
