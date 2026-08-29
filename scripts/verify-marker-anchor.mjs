/**
 * Confirms consultant markers stay geographically anchored while panning/zooming.
 * Requires Chrome + playwright-core. MAP_VERIFY_URL defaults to http://localhost:3010
 */
import { chromium } from "playwright-core";

const BASE = process.env.MAP_VERIFY_URL ?? "http://localhost:3010";

function center(box) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function shiftedWithMap(before, after, deltaX, deltaY, tolerance = 18) {
  return (
    Math.abs(after.x - (before.x + deltaX)) <= tolerance &&
    Math.abs(after.y - (before.y + deltaY)) <= tolerance
  );
}

async function main() {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/team`);
  await page.locator('[data-view="map"]').click();
  await page.locator('[data-provider-option="openfreemap"]').click();
  await page
    .locator('[data-testid="maplibre-canvas"][data-map-engine="openfreemap"][data-map-ready="true"]')
    .waitFor({ timeout: 25000 });
  await page.locator('[data-geo-day="2026-09-03"]').click();
  await page.locator('[data-testid="fit-jobs"]').click();
  await page.locator(".prensa-map-marker-initials, .prensa-map-cluster").first().waitFor({
    timeout: 15000,
  });
  const zoomIn = page.locator('[data-testid="map-zoom-in"]');
  for (let i = 0; i < 4; i += 1) {
    const hasTaylor = await page.locator(".prensa-map-marker-initials", { hasText: "TR" }).count();
    if (hasTaylor > 0) break;
    await zoomIn.click();
    await page.waitForTimeout(400);
  }

  const structure = await page.evaluate(() => {
    const initials = [...document.querySelectorAll(".prensa-map-marker-initials")].find(
      (node) => node.textContent === "TR"
    );
    if (!initials) return { found: false };
    const visual = initials.closest(".prensa-map-marker");
    const root = initials.closest(".maplibregl-marker");
    return {
      found: true,
      initialsInsideVisual: Boolean(visual?.contains(initials)),
      visualInsideRoot: Boolean(root?.contains(visual)),
      rootHasMapLibreClass: root?.classList.contains("maplibregl-marker") ?? false,
      rootHasAnchorClass: root?.classList.contains("prensa-map-marker-anchor") ?? false,
      rootTransform: root ? getComputedStyle(root).transform : "",
      visualTransform: visual ? getComputedStyle(visual).transform : "",
      rootPosition: root ? getComputedStyle(root).position : "",
    };
  });
  if (!structure.found) {
    const dump = await page.evaluate(() => ({
      initials: [...document.querySelectorAll(".prensa-map-marker-initials")].map((n) => n.textContent),
      clusters: document.querySelectorAll(".prensa-map-cluster").length,
    }));
    throw new Error(`Taylor TR marker not found ${JSON.stringify(dump)}`);
  }
  if (!structure.initialsInsideVisual) throw new Error("TR is not inside the marker visual");
  if (!structure.visualInsideRoot) throw new Error("Marker visual is not inside the MapLibre root");
  if (!structure.rootHasMapLibreClass) throw new Error("MapLibre class missing on marker root");
  if (structure.rootPosition !== "absolute") throw new Error(`Marker root position is ${structure.rootPosition}`);
  if (structure.visualTransform !== "none") {
    throw new Error(`Visual node has unexpected transform: ${structure.visualTransform}`);
  }

  const otherInitials = await page.evaluate(() =>
    [...document.querySelectorAll(".prensa-map-marker-initials")].map((node) => node.textContent)
  );
  for (const initials of ["AM", "JL"]) {
    if (!otherInitials.includes(initials)) {
      throw new Error(`Missing ${initials} marker. Found: ${otherInitials.join(",")}`);
    }
  }

  const marker = page.locator(".prensa-map-marker-initials", { hasText: "TR" }).first();
  const canvas = page.locator('[data-testid="maplibre-canvas"]');
  const before = await marker.boundingBox();
  if (!before) throw new Error("No TR bounding box");
  const mapBox = await canvas.boundingBox();
  if (!mapBox) throw new Error("No map box");
  const start = { x: mapBox.x + mapBox.width / 2, y: mapBox.y + mapBox.height / 2 };
  const deltaX = 140;
  const deltaY = 70;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + deltaX, start.y + deltaY, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const afterPan = await marker.boundingBox();
  if (!afterPan) throw new Error("TR missing after pan");
  if (!shiftedWithMap(center(before), center(afterPan), deltaX, deltaY)) {
    throw new Error(
      `TR did not stay geographically anchored during pan. before=${JSON.stringify(center(before))} after=${JSON.stringify(center(afterPan))}`
    );
  }

  await page.locator('[data-testid="map-zoom-in"]').click();
  await page.waitForTimeout(400);
  await page.locator('[data-testid="map-zoom-out"]').click();
  await page.waitForTimeout(400);
  const afterZoom = await marker.boundingBox();
  if (!afterZoom) throw new Error("TR missing after zoom");
  const stillInside = await page.evaluate(() => {
    const initials = [...document.querySelectorAll(".prensa-map-marker-initials")].find(
      (node) => node.textContent === "TR"
    );
    return Boolean(initials?.closest(".prensa-map-marker")?.closest(".maplibregl-marker"));
  });
  if (!stillInside) throw new Error("TR detached from MapLibre marker after zoom");

  await marker.click();
  const selected = await page.evaluate(() => {
    const initials = [...document.querySelectorAll(".prensa-map-marker-initials")].find(
      (node) => node.textContent === "TR"
    );
    const visual = initials?.closest(".prensa-map-marker");
    const root = initials?.closest(".maplibregl-marker");
    return {
      selected: visual?.classList.contains("is-selected") ?? false,
      rootTransform: root ? getComputedStyle(root).transform : "",
      visualTransform: visual ? getComputedStyle(visual).transform : "",
    };
  });
  if (!selected.selected) throw new Error("Selection did not style the inner marker");
  if (selected.visualTransform !== "none") {
    throw new Error("Selection applied a transform to the inner visual");
  }

  await page.locator('[data-geo-day="week"]').click();
  await page.locator('[data-consultant-name="c-taylor"]').click();
  await page.locator('[data-testid="fit-jobs"]').click();
  await page.locator(".prensa-map-marker-initials, .prensa-map-cluster").first().waitFor({
    timeout: 10000,
  });
  for (let i = 0; i < 5; i += 1) {
    if ((await page.locator(".prensa-map-marker-initials", { hasText: "TR" }).count()) > 0) break;
    await page.locator('[data-testid="map-zoom-in"]').click();
    await page.waitForTimeout(350);
  }
  if ((await page.locator(".prensa-map-marker-initials", { hasText: "TR" }).count()) === 0) {
    throw new Error("Taylor marker missing after Whole Week / focus uncluster");
  }

  await page.locator('[data-provider-option="local-maplibre"]').click();
  await page
    .locator('[data-testid="maplibre-canvas"][data-map-engine="local-maplibre"][data-map-ready="true"]')
    .waitFor({ timeout: 20000 });
  await page.locator('[data-testid="fit-jobs"]').click();
  await page.locator(".prensa-map-marker-initials, .prensa-map-cluster").first().waitFor({
    timeout: 15000,
  });
  for (let i = 0; i < 4; i += 1) {
    if ((await page.locator(".prensa-map-marker-initials", { hasText: "TR" }).count()) > 0) break;
    await page.locator('[data-testid="map-zoom-in"]').click();
    await page.waitForTimeout(400);
  }
  const localTr = await page.locator(".prensa-map-marker-initials", { hasText: "TR" }).count();
  if (localTr === 0) throw new Error("Local MapLibre lost Taylor marker");

  console.log("MARKER_ANCHOR_E2E_OK");
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
