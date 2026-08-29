/**
 * Optional browser check for Team Planner map providers.
 * Requires Chrome and playwright-core (`npm install --no-save playwright-core`).
 * MAP_VERIFY_URL defaults to http://localhost:3010
 */
import { chromium } from "playwright-core";

const BASE = process.env.MAP_VERIFY_URL ?? "http://localhost:3010";
const disallowed = [
  /maps\/api\/geocode/i,
  /maps\/api\/place/i,
  /maps\/api\/directions/i,
  /maps\/api\/distancematrix/i,
  /places\.googleapis\.com/i,
  /routes\.googleapis\.com/i,
  /api\.mapbox\.com/i,
  /atlas\.microsoft\.com/i,
  /nominatim\.openstreetmap\.org/i,
  /tile\.openstreetmap\.org/i,
  /router\.project-osrm\.org/i,
];

const blocked = [];
const openFreeMapUrls = [];

async function main() {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"],
  });
  const page = await browser.newPage();
  page.on("request", (request) => {
    const url = request.url();
    if (disallowed.some((pattern) => pattern.test(url))) blocked.push(url);
    if (url.includes("tiles.openfreemap.org")) openFreeMapUrls.push(url);
    if (/nambour|tj-120|pr-test|prensa/i.test(url) && url.includes("tiles.openfreemap.org")) {
      blocked.push(`metadata-in-tile-url:${url}`);
    }
  });

  await page.goto(`${BASE}/`);
  await page.getByRole("button", { name: /optimise my day/i }).waitFor({ timeout: 15000 });

  await page.goto(`${BASE}/team`);
  await page.locator('[data-view="map"]').click();
  const map = page.locator('[data-testid="geo-map"]');
  await map.waitFor();

  await page.locator('[data-provider-option="openfreemap"]').click();
  await page.locator('[data-testid="maplibre-canvas"][data-map-engine="openfreemap"][data-map-ready="true"]').waitFor({
    timeout: 25000,
  });
  if ((await map.getAttribute("data-map-provider")) !== "openfreemap") {
    throw new Error("Expected OpenFreeMap provider");
  }
  if (openFreeMapUrls.length === 0) {
    throw new Error("Expected requests to tiles.openfreemap.org");
  }

  await page.locator('[data-geo-day="2026-09-03"]').click();
  await page.locator('[data-testid="fit-jobs"]').click();
  await page.getByLabel("Search jobs on map").fill("Nambour");
  await page.locator('[data-testid="match-panel"]').waitFor();
  const first = page.locator('[data-testid="match-panel"] [data-match-rank="1"]');
  if ((await first.getAttribute("data-match-consultant")) !== "c-taylor") {
    throw new Error("Expected Taylor as rank 1");
  }
  if ((await first.getAttribute("data-match-date")) !== "2026-09-03") {
    throw new Error("Expected Thursday rank 1");
  }
  await page.locator('[data-testid="schematic-insertion-caption"]').waitFor();

  await page.locator('[data-testid="match-panel"] [data-match-consultant="c-alex"]').first().click();
  await page.locator('[data-preview-consultant="c-alex"]').waitFor();
  await first.click();
  await page.locator('[data-preview-consultant="c-taylor"]').waitFor();

  await page.locator('[data-testid="assign-from-map"]').click();
  await page.locator('[data-testid="scheduled-job-panel"]').waitFor();
  await page.keyboard.press("Control+z");
  await page.locator('[data-testid="match-panel"]').waitFor();

  await page.locator('[data-view="split"]').click();
  await page.locator('[data-testid="maplibre-canvas"][data-map-ready="true"]').waitFor();
  await page.getByRole("grid", { name: "Weekly allocation board" }).waitFor();

  await page.locator('[data-consultant-name="c-taylor"]').click();
  await page.locator('[data-geo-day="week"]').click();
  await page.locator('[data-testid="fit-jobs"]').click();

  await page.locator('[data-provider-option="local-maplibre"]').click();
  await page.locator('[data-testid="maplibre-canvas"][data-map-engine="local-maplibre"][data-map-ready="true"]').waitFor({
    timeout: 20000,
  });

  await page.locator('[data-provider-option="google"]').click();
  await page.locator('[data-testid="google-maps-unavailable"]').waitFor();
  await page.locator('[data-testid="switch-to-local-map"]').click();
  await page.locator('[data-testid="maplibre-canvas"][data-map-engine="local-maplibre"][data-map-ready="true"]').waitFor({
    timeout: 20000,
  });

  if (blocked.length > 0) {
    throw new Error(`Disallowed network requests: ${blocked.join(", ")}`);
  }

  console.log("MAP_PROVIDER_E2E_OK");
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
