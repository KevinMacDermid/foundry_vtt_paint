/**
 * Smoke test: verifies the foundry-paint module loads and works in-game.
 *
 * Prerequisites:
 *   - Foundry server running in tmux: tmux new-session -d -s foundry '...'
 *   - test1 world active
 *   - foundry-paint module enabled
 *
 * Usage:
 *   node test/smoke.mjs
 */

import { chromium } from "playwright";

const BASE_URL = "http://localhost:30000";
let exitCode = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
  } else {
    console.log(`  ❌ ${msg}`);
    exitCode = 1;
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleLogs = [];
  page.on("console", (msg) => consoleLogs.push(msg.text()));

  // Join the game as Gamemaster
  await page.goto(`${BASE_URL}/join`, { waitUntil: "networkidle" });
  await page.locator('select[name="userid"]').selectOption({ label: "Gamemaster" });
  await page.locator("button").filter({ hasText: /join|log/i }).first().click();
  await page.waitForTimeout(8000);

  console.log("Foundry Paint — Smoke Test");
  console.log("==========================");

  // 1. Landed on the game page
  assert(page.url().includes("/game"), "Joined game successfully");

  // 2. Module logged to console
  const initLog = consoleLogs.some((l) => l.includes("Foundry Paint | Initializing"));
  assert(initLog, "Module init console log present");

  // 3. Paint palette button is visible in scene controls
  const btn = page.locator('[data-control="foundry-paint"]');
  const visible = await btn.isVisible().catch(() => false);
  assert(visible, "Paint palette button is visible in scene controls");

  // 4. Clicking the palette button activates the paint tools
  if (visible) {
    await btn.click();
    await page.waitForTimeout(500);
    const drawBtn = page.locator('[data-tool="paint-draw"]');
    const drawVisible = await drawBtn.isVisible().catch(() => false);
    assert(drawVisible, "Paint draw tool button appears after activating paint controls");
  }

  // 5. Module is registered and active in game.modules
  const moduleInfo = await page.evaluate(() => {
    const m = game.modules.get("foundry-paint");
    return m ? { id: m.id, active: m.active } : null;
  });
  assert(moduleInfo?.active === true, "Module is active in game.modules");

  console.log("");
  console.log(exitCode === 0 ? "All checks passed." : "Some checks failed.");

  await browser.close();
  process.exit(exitCode);
}

run().catch((e) => {
  console.error("Test error:", e.message);
  process.exit(1);
});
