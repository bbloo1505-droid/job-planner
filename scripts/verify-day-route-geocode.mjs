/**
 * Browser check for Day Route address search + sampling duration.
 * MAP_VERIFY_URL defaults to http://localhost:3010
 */
import { chromium } from "playwright-core";

const BASE = process.env.MAP_VERIFY_URL ?? "http://localhost:3010";
const nominatimHits = [];
const blocked = [];

async function main() {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("nominatim.openstreetmap.org") && !url.includes("/api/geocode")) {
      if (!url.startsWith(BASE)) blocked.push(`browser-nominatim:${url}`);
    }
    if (url.includes("/api/geocode")) nominatimHits.push(url);
  });

  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.getByText(/Prototype geocoding uses an external OpenStreetMap service/i).waitFor();

  const paste = page.getByPlaceholder(/paste additional addresses|paste addresses/i);
  await paste.fill("1 William Street, Brisbane");
  await page.getByRole("button", { name: /add properties/i }).click();

  const findButtons = page.getByRole("button", { name: /^find address$/i });
  await findButtons.last().waitFor({ timeout: 15000 });
  await findButtons.last().click();

  try {
    await page.getByRole("button", { name: /use this address/i }).first().waitFor({
      timeout: 60000,
    });
  } catch (error) {
    console.error(await page.locator("body").innerText());
    throw error;
  }
  await page.getByRole("button", { name: /use this address/i }).first().click();
  await page.getByText("Brisbane City", { exact: false }).first().waitFor();

  await page.getByRole("button", { name: /optimise my day/i }).click();
  await page.getByText("sampling", { exact: false }).first().waitFor();
  await page.getByText("min on site").first().waitFor();

  await page.getByText("Indooroopilly", { exact: true }).first().click();
  await page.getByRole("button", { name: "45", exact: true }).click();
  await page.getByText(/duration changed from \d+ to 45 min/i).waitFor();

  if (blocked.length > 0) {
    throw new Error(`Browser contacted Nominatim directly: ${blocked.join(", ")}`);
  }
  if (nominatimHits.length === 0) {
    throw new Error("Expected /api/geocode to be called");
  }

  console.log("DAY_ROUTE_GEOCODE_E2E_OK");
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
