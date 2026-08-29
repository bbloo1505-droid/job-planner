import { chromium } from "playwright-core";

const BASE = process.env.MOBILE_VERIFY_URL ?? "http://localhost:3010";

function stacked(above, below) {
  if (!above || !below) throw new Error("Missing layout boxes");
  const overlap =
    Math.min(above.y + above.height, below.y + below.height) - Math.max(above.y, below.y);
  if (overlap > 8) {
    throw new Error(
      `Panels overlap by ${Math.round(overlap)}px (above y=${above.y} h=${above.height}, below y=${below.y})`
    );
  }
  if (below.y + 4 < above.y + above.height) {
    throw new Error("Lower panel is not stacked below the main pane");
  }
}

async function clickTestId(page, testId) {
  await page.waitForFunction((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    return Boolean(el && Object.keys(el).some((key) => key.startsWith("__react")));
  }, testId);
  await page.locator(`[data-testid="${testId}"]`).evaluate((el) => {
    if (el instanceof HTMLElement) el.click();
  });
}

async function openDrawer(page) {
  await clickTestId(page, "open-menu");
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="open-menu"]')?.getAttribute("aria-expanded") ===
      "true"
  );
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  phone.setDefaultTimeout(60000);
  phone.on("pageerror", (err) => console.log("PAGEERROR", err.message));
  phone.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      console.log("CONSOLE", msg.type(), msg.text());
    }
  });

  await phone.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await phone.getByTestId("open-menu").waitFor();

  const phoneMeta = await phone.evaluate(() => ({
    width: window.innerWidth,
    md: window.matchMedia("(min-width: 768px)").matches,
    hamburger: getComputedStyle(document.querySelector('[data-testid="open-menu"]')).display,
    react: Object.keys(document.querySelector('[data-testid="open-menu"]') ?? {}).some((key) =>
      key.startsWith("__react")
    ),
  }));
  if (phoneMeta.md || phoneMeta.hamburger === "none") {
    throw new Error(`Phone chrome should show the hamburger: ${JSON.stringify(phoneMeta)}`);
  }

  await openDrawer(phone);
  await phone.getByTestId("mobile-drawer").locator("[data-nav='/team']").click();
  await phone.getByTestId("team-planner-app").waitFor();
  if ((await phone.getByTestId("open-menu").getAttribute("aria-expanded")) !== "false") {
    throw new Error("Menu should close after navigating");
  }

  const board = await phone.locator(".prensa-planner-scroll").boundingBox();
  const teamAside = await phone.locator("[data-testid='team-planner-app'] aside").boundingBox();
  stacked(board, teamAside);
  if (!(board.height > 360)) {
    throw new Error(`Team board is too short on phone (${board.height}px)`);
  }
  if (teamAside && teamAside.height > 80) {
    throw new Error(`Unassigned dock should stay collapsed on phone (${teamAside.height}px)`);
  }
  const boardScroll = await phone.locator(".prensa-planner-scroll").evaluate((el) => ({
    client: el.clientWidth,
    scroll: el.scrollWidth,
  }));
  if (!(boardScroll.scroll > boardScroll.client + 20)) {
    throw new Error("Team board should still scroll horizontally");
  }

  await openDrawer(phone);
  await phone.getByTestId("mobile-drawer").locator("[data-nav='/team/map']").click();
  await phone.getByTestId("planner-map-app").waitFor();
  const map = await phone.getByTestId("geo-map").boundingBox();
  const mapAside = await phone.locator("[data-testid='planner-map-app'] aside").boundingBox();
  stacked(map, mapAside);
  if (!(map.height > 360)) {
    throw new Error(`Allocation map is too short on phone (${map?.height}px)`);
  }
  if (mapAside && mapAside.height > 80) {
    throw new Error(`Map jobs dock should stay collapsed on phone (${mapAside.height}px)`);
  }

  await openDrawer(phone);
  await phone.getByTestId("mobile-drawer").locator("[data-nav='/reports']").click();
  await phone.locator("[data-page='reports'][data-client='ready']").waitFor();
  await phone.getByRole("heading", { name: "Reports & Analytics" }).waitFor();

  await openDrawer(phone);
  await phone.getByTestId("mobile-drawer").locator("[data-nav='/']").click();
  await phone.getByTestId("plan-my-day").waitFor();
  const planBox = await phone.getByTestId("plan-my-day").boundingBox();
  if (!planBox || planBox.y + planBox.height > 844 + 4) {
    throw new Error("Plan my day button should stay on screen");
  }

  const pageOverflow = await phone.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
  );
  if (pageOverflow) throw new Error("Home page should not overflow horizontally on phone");

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  desktop.setDefaultTimeout(60000);
  await desktop.goto(`${BASE}/team`, { waitUntil: "domcontentloaded" });
  await desktop.getByTestId("team-planner-app").waitFor();
  if (await desktop.getByTestId("open-menu").isVisible()) {
    throw new Error("Hamburger should be hidden on desktop");
  }
  if (!(await desktop.locator("[data-nav='/team']").first().isVisible())) {
    throw new Error("Desktop sidebar should stay visible");
  }
  const deskBoard = await desktop.locator(".prensa-planner-scroll").boundingBox();
  const deskAside = await desktop.locator("[data-testid='team-planner-app'] aside").boundingBox();
  if (!deskBoard || !deskAside) throw new Error("Desktop planner layout missing");
  if (deskAside.x < deskBoard.x + deskBoard.width - 24) {
    throw new Error("Desktop jobs panel should sit beside the board, not below it");
  }

  console.log(
    JSON.stringify(
      {
        phone: { phoneMeta, board, teamAside, map, mapAside, planBox, boardScroll },
        desktop: { deskBoard, deskAside },
      },
      null,
      2
    )
  );

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
