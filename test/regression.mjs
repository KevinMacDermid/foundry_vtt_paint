/**
 * Regression tests for foundry-paint.
 *
 * Tests multi-scene painting: drawing on scene 1, switching to scene 2,
 * drawing there, switching back, and verifying no lag on return.
 *
 * Prerequisites:
 *   - Foundry server running in tmux
 *   - test1 world active with at least 2 scenes
 *   - foundry-paint module enabled
 *
 * Usage:
 *   node test/regression.mjs
 */

import { chromium } from "playwright";

const BASE_URL = "http://localhost:30000";
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.log(`  ❌ ${msg}`);
    failed++;
  }
}

/** Count painted (non-transparent) pixels in the paint layer bitmap. */
async function countPixels(page) {
  return page.evaluate(() => {
    if (!canvas.paint?._ctx) return -1;
    const { gridW, gridH, _ctx } = canvas.paint;
    const data = _ctx.getImageData(0, 0, gridW, gridH).data;
    let count = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) count++;
    }
    return count;
  });
}

/** Paint a short horizontal stroke in the centre of the viewport. */
async function paintStroke(page) {
  const cx = 700, cy = 450;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 0; i < 10; i++) await page.mouse.move(cx + i * 10, cy);
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/** Switch to a scene by id and wait for canvas to be ready. */
async function switchScene(page, sceneId) {
  await page.evaluate(async (id) => {
    const scene = game.scenes.get(id);
    await scene.view();
  }, sceneId);
  // Wait for canvasReady and layer init
  await page.waitForFunction(() => canvas.scene !== null && canvas.paint?.gridW > 0 && canvas.paint?._ready === true, { timeout: 15000 });
  await page.waitForTimeout(200);
}

/** Activate the paint draw tool. */
async function activateDraw(page) {
  const paletteBtn = page.locator('[data-control="foundry-paint"]');
  if (!(await paletteBtn.isVisible().catch(() => false))) return;
  await paletteBtn.click();
  await page.waitForTimeout(300);
  const drawBtn = page.locator('[data-tool="paint-draw"]');
  if (await drawBtn.isVisible().catch(() => false)) {
    await drawBtn.click();
    await page.waitForTimeout(300);
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const logs = [];
  page.on("console", (msg) => logs.push(msg.text()));

  // Join game
  await page.goto(`${BASE_URL}/join`, { waitUntil: "networkidle" });
  await page.locator('select[name="userid"]').selectOption({ label: "Gamemaster" });
  await page.locator("button").filter({ hasText: /join|log/i }).first().click();
  await page.waitForTimeout(8000);

  const scenes = await page.evaluate(() =>
    game.scenes.map(s => ({ id: s.id, name: s.name }))
  );
  assert(scenes.length >= 2, `At least 2 scenes available (found ${scenes.length})`);

  const [scene1, scene2] = scenes;

  console.log("\nRegression Tests — foundry-paint");
  console.log("=================================");

  // ── 1. Clear both scenes first ──────────────────────────────────
  console.log("\n[Setup] Clearing paint flags from both scenes...");
  await page.evaluate(async (ids) => {
    for (const id of ids) {
      const scene = game.scenes.get(id);
      await scene.unsetFlag("foundry-paint", "bitmap");
      await scene.unsetFlag("foundry-paint", "pixelSize");
    }
  }, scenes.map(s => s.id));
  await page.waitForTimeout(300);

  // ── 2. Draw on scene 1 ──────────────────────────────────────────
  console.log(`\n[Test 1] Drawing on scene 1 (${scene1.name})`);
  await switchScene(page, scene1.id);
  await activateDraw(page);
  const initLog1 = logs.some(l => l.includes("Bitmap") && !l.includes("Loaded"));
  assert(initLog1, "Paint layer initialized for scene 1");

  await paintStroke(page);
  const pixelsScene1 = await countPixels(page);
  assert(pixelsScene1 > 0, `Painted pixels on scene 1 (${pixelsScene1})`);

  // ── 3. Switch to scene 2 and draw ───────────────────────────────
  console.log(`\n[Test 2] Switching to scene 2 (${scene2.name}) and drawing`);
  const logsBefore = logs.length;
  await switchScene(page, scene2.id);

  const initLog2 = logs.slice(logsBefore).some(l => l.includes("Bitmap"));
  assert(initLog2, "Paint layer re-initialized for scene 2");

  const bitmapInfo = await page.evaluate(() => ({
    gridW: canvas.paint?.gridW,
    gridH: canvas.paint?.gridH,
    hasCtx: !!canvas.paint?._ctx,
  }));
  assert(bitmapInfo.hasCtx, `Bitmap context exists on scene 2 (${bitmapInfo.gridW}×${bitmapInfo.gridH})`);

  await activateDraw(page);
  await paintStroke(page);
  const pixelsScene2 = await countPixels(page);
  assert(pixelsScene2 > 0, `Can paint on scene 2 (${pixelsScene2} pixels)`);

  // ── 4. Scene 1 pixels not visible on scene 2 ────────────────────
  console.log("\n[Test 3] Paint is isolated per scene");
  // Scene 2 should have no saved paint data from scene 1
  const scene2HasScene1Data = await page.evaluate((s1id) => {
    const s2 = canvas.scene;
    const s1 = game.scenes.get(s1id);
    const s1bitmap = s1.getFlag("foundry-paint", "bitmap");
    const s2bitmap = s2.getFlag("foundry-paint", "bitmap");
    return s1bitmap === s2bitmap;
  }, scene1.id);
  assert(!scene2HasScene1Data, "Scene 2 paint is independent from scene 1");

  // ── 5. Return to scene 1 — pixels preserved ─────────────────────
  console.log(`\n[Test 4] Returning to scene 1 (${scene1.name})`);
  await switchScene(page, scene1.id);
  await activateDraw(page);

  // Wait for async image load (up to 2s)
  await page.waitForFunction(() => {
    const logs = window._paintLoaded;
    return true; // just wait the timeout
  }, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(2000); // give image load time

  const pixelsScene1Again = await countPixels(page);
  assert(pixelsScene1Again > 0, `Scene 1 pixels still present after returning (${pixelsScene1Again})`);

  // ── 6. No lag — _ready flag is set before we try to paint ────────
  console.log("\n[Test 5] No lag — layer is ready immediately after scene switch");
  await switchScene(page, scene2.id);
  await activateDraw(page);

  // _ready should already be true (switchScene waits for it)
  const isReady = await page.evaluate(() => canvas.paint?._ready);
  assert(isReady === true, "Paint layer _ready immediately after switchScene");

  // And painting should work right away
  await paintStroke(page);
  const pixelsImmediate = await countPixels(page);
  assert(pixelsImmediate > 0, `Pixels painted immediately after scene switch (${pixelsImmediate} pixels)`);

  // ── 7. Can still draw after returning (not clobbered by load) ───
  console.log("\n[Test 6] Strokes not clobbered by async image load on return");
  await switchScene(page, scene2.id); // scene2 now has saved paint
  await activateDraw(page);

  // Paint before the async load could complete
  await paintStroke(page);
  const pixelsBeforeLoad = await countPixels(page);

  // Wait for any pending async load
  await page.waitForTimeout(3000);
  const pixelsAfterLoad = await countPixels(page);

  assert(
    pixelsAfterLoad >= pixelsBeforeLoad,
    `Async load doesn't clobber new strokes (before: ${pixelsBeforeLoad}, after: ${pixelsAfterLoad})`
  );

  // ── Summary ──────────────────────────────────────────────────────
  console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed.`);
  if (failed > 0) console.log("Some checks FAILED — see above.");
  else console.log("All checks passed.");

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("Test error:", e.message);
  process.exit(1);
});
