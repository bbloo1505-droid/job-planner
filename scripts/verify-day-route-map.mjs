/**
 * Browser check for the Day Route OpenFreeMap map.
 * Requires Chrome and playwright-core.
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
  /api\.heigit\.org/i,
  /openrouteservice/i,
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
    if (
      /indooroopilly|darra|oxley|prensa|pr-test|job-/i.test(url) &&
      url.includes("tiles.openfreemap.org")
    ) {
      blocked.push(`metadata-in-tile-url:${url}`);
    }
  });

  await page.goto(`${BASE}/`);
  await page.getByRole("button", { name: /optimise my day/i }).click();
  const map = page.locator('[data-testid="day-route-map"]');
  await map.waitFor();
  await page
    .locator('[data-testid="day-route-map"][data-map-engine="openfreemap"][data-map-ready="true"]')
    .waitFor({ timeout: 25000 });
  await page.getByRole("button", { name: /fit route/i }).waitFor();
  await page
    .getByText(
      /Fastest road route via openrouteservice|Road route via openrouteservice|Estimated route — live road routing unavailable|Schematic route line/
    )
    .waitFor();

  const stopCount = await page.locator(".prensa-day-route-stop").count();
  if (stopCount < 5) {
    throw new Error(`Expected numbered route stops, found ${stopCount}`);
  }

  const zeroDrives = page.getByText("0 min drive");
  if ((await zeroDrives.count()) > 0) {
    throw new Error("Unexpected 0 min drive on the demo Brisbane corridor");
  }

  await page.getByText("Indooroopilly", { exact: true }).first().click();
  await page.locator(".prensa-day-route-stop.is-selected").waitFor();

  await page.getByRole("button", { name: /edit properties/i }).click();
  await page.getByRole("button", { name: /add property/i }).click();
  const inputs = page.locator('input[aria-label^="Address"]');
  await inputs.last().fill("999 Nowhere St, Notasuburb");
  await page.getByText("Unresolved").waitFor();
  await page.getByRole("button", { name: /optimise my day/i }).click();
  await page.getByText("Location not resolved").waitFor();
  await page.getByText("Travel time unavailable").waitFor();

  if (openFreeMapUrls.length === 0) {
    throw new Error("Expected requests to tiles.openfreemap.org");
  }
  if (blocked.length > 0) {
    throw new Error(`Disallowed network requests: ${blocked.join(", ")}`);
  }

  await page.goto(`${BASE}/team/map`);
  await page
    .locator('[data-testid="maplibre-canvas"][data-map-ready="true"]')
    .waitFor({ timeout: 25000 });

  console.log("DAY_ROUTE_MAP_E2E_OK");
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
