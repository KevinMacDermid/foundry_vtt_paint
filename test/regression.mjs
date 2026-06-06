/**
 * Regression tests for previously fixed bugs.
 *
 * Prerequisites:
 *   - Foundry server running
 *   - test1 world active with foundry-paint module enabled
 *   - Gamemaster NOT already logged in
 *
 * Usage:
 *   node test/regression.mjs
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

  page.on("console", () => {}); // suppress noise

  // Join as Gamemaster
  await page.goto(`${BASE_URL}/join`, { waitUntil: "networkidle" });
  await page.locator('select[name="userid"]').selectOption({ label: "Gamemaster" });
  await page.locator("button").filter({ hasText: /join|log/i }).first().click();
  await page.waitForTimeout(8000);

  console.log("Foundry Paint — Regression Tests");
  console.log("=================================");

  // ── Regression: tokens unclickable after using paint tool ────────────────
  // Bug: _activate() set this.interactive=true (deprecated PIXI alias) which left
  // stale flags after deactivation, causing the paint layer to keep absorbing
  // pointer events even when the tokens layer was active.
  // Fix: removed interactive=true from _activate; set sprite.eventMode="none".

  console.log("\n[Regression] Paint layer releases pointer events on deactivation");

  const result = await page.evaluate(async () => {
    const layer = canvas.paint;
    if (!layer) return { found: false };

    // Activate paint layer
    const paintBtn = document.querySelector('[data-control="foundry-paint"]');
    paintBtn?.click();
    await new Promise(r => setTimeout(r, 500));

    const activatedEventMode = layer.eventMode;
    const activatedSpriteEventMode = layer._sprite?.eventMode;

    // Switch to tokens layer
    const tokenBtn = document.querySelector('[data-control="tokens"]');
    tokenBtn?.click();
    await new Promise(r => setTimeout(r, 500));

    const deactivatedEventMode = layer.eventMode;
    const deactivatedSpriteEventMode = layer._sprite?.eventMode;

    return {
      found: true,
      activatedEventMode,
      activatedSpriteEventMode,
      deactivatedEventMode,
      deactivatedSpriteEventMode,
    };
  });

  assert(result.found, "PaintCanvasLayer found on canvas");
  assert(
    result.activatedEventMode === "static",
    `Paint layer eventMode is "static" when active (got "${result.activatedEventMode}")`
  );
  assert(
    result.activatedSpriteEventMode === "none",
    `Sprite eventMode is "none" when layer active (got "${result.activatedSpriteEventMode}")`
  );
  assert(
    result.deactivatedEventMode === "passive",
    `Paint layer eventMode is "passive" after switching away (got "${result.deactivatedEventMode}")`
  );
  assert(
    result.deactivatedSpriteEventMode === "none",
    `Sprite eventMode stays "none" after switching away (got "${result.deactivatedSpriteEventMode}")`
  );

  console.log("");
  console.log(exitCode === 0 ? "All checks passed." : "Some checks failed.");

  await browser.close();
  process.exit(exitCode);
}

run().catch((e) => {
  console.error("Test error:", e.message);
  process.exit(1);
});
