/**
 * Multiplayer sync test: verifies that when scene flags are updated (as they would be
 * when another client paints), the local client reloads the bitmap via the updateScene hook.
 *
 * Prerequisites:
 *   - Foundry server running
 *   - test1 world active with foundry-paint module enabled
 *   - Gamemaster NOT already logged in
 *
 * Usage:
 *   node test/multiplayer.mjs
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

// Minimal 1x1 transparent PNG as a base64 data URL
const DUMMY_BITMAP = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleLogs = [];
  page.on("console", (msg) => consoleLogs.push(msg.text()));

  // Join as Gamemaster
  await page.goto(`${BASE_URL}/join`, { waitUntil: "networkidle" });
  await page.locator('select[name="userid"]').selectOption({ label: "Gamemaster" });
  await page.locator("button").filter({ hasText: /join|log/i }).first().click();
  await page.waitForTimeout(8000);

  console.log("Foundry Paint — Multiplayer Sync Test");
  console.log("======================================");

  assert(page.url().includes("/game"), "Joined game successfully");

  // 1. Patch _loadFromScene to track calls, then update the flag — simulates a remote client painting
  const result = await page.evaluate(async (dummyBitmap) => {
    const layer = canvas.layers.find(l => l.constructor.name === "PaintCanvasLayer");
    if (!layer) return { found: false };

    // Track calls to _loadFromScene
    let callCount = 0;
    const original = layer._loadFromScene.bind(layer);
    layer._loadFromScene = async function() {
      callCount++;
      return original();
    };

    // Update the flag — this triggers updateScene on all clients (including this one)
    await canvas.scene.setFlag("foundry-paint", "bitmap", dummyBitmap);

    // Give the hook time to fire
    await new Promise(r => setTimeout(r, 1000));

    return { found: true, callCount };
  }, DUMMY_BITMAP);

  assert(result.found, "PaintCanvasLayer found on canvas");
  assert(result.callCount >= 1, `_loadFromScene called when scene flags updated (called ${result.callCount} time(s))`);

  // 2. Verify the bitmap is actually loaded into the layer after the flag update
  const bitmapLoaded = await page.evaluate(() => {
    const layer = canvas.layers.find(l => l.constructor.name === "PaintCanvasLayer");
    // If the sprite has a valid texture, the bitmap was loaded
    return layer?._sprite?.texture?.valid ?? false;
  });
  assert(bitmapLoaded, "Bitmap texture is valid after flag update");

  // 3. Clean up — clear the flag so we don't leave a test bitmap in the scene
  await page.evaluate(async () => {
    await canvas.scene.unsetFlag("foundry-paint", "bitmap");
  });
  console.log("\n  (Test bitmap cleared from scene.)");

  console.log("");
  console.log(exitCode === 0 ? "All checks passed." : "Some checks failed.");

  await browser.close();
  process.exit(exitCode);
}

run().catch((e) => {
  console.error("Test error:", e.message);
  process.exit(1);
});
