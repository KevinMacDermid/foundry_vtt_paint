/**
 * Eraser cursor regression test.
 * Reproduces the bug where the eraser cursor stops appearing after switching scenes.
 *
 * Prerequisites:
 *   - Foundry server running
 *   - test1 world active with foundry-paint enabled
 *   - Gamemaster NOT already logged in
 *
 * Usage:
 *   node test/eraser-cursor.mjs
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
  page.on("console", () => {});

  await page.goto(`${BASE_URL}/join`, { waitUntil: "networkidle" });
  await page.locator('select[name="userid"]').selectOption({ label: "Gamemaster" });
  await page.locator("button").filter({ hasText: /join|log/i }).first().click();
  await page.waitForTimeout(8000);

  console.log("Foundry Paint — Eraser Cursor Tests");
  console.log("=====================================");

  // ── 1. Activate erase tool ───────────────────────────────────────────────
  console.log("\n[1] Initial eraser cursor state");

  const initial = await page.evaluate(async () => {
    // Activate paint controls
    document.querySelector('[data-control="foundry-paint"]')?.click();
    await new Promise(r => setTimeout(r, 500));

    // Select erase tool
    document.querySelector('[data-tool="paint-erase"]')?.click();
    await new Promise(r => setTimeout(r, 300));

    const layer = canvas.paint;

    // Simulate a pointermove to trigger cursor creation
    layer._onStageMove({ getLocalPosition: () => ({ x: 500, y: 500 }) });

    return {
      isErasing: layer.isErasing,
      handlerCount: canvas.stage.listenerCount("pointermove"),
      cursorExists: !!layer._eraserCursor && !layer._eraserCursor.destroyed,
      cursorRenderable: layer._eraserCursor?.renderable ?? null,
      cursorVisible: layer._eraserCursor?.visible ?? null,
      cursorGeometryEmpty: layer._eraserCursor?.geometry?.graphicsData?.length === 0,
    };
  });

  assert(initial.isErasing, "isErasing is true with erase tool active");
  assert(initial.handlerCount > 0, `canvas.stage has pointermove listener(s) (count: ${initial.handlerCount})`);
  assert(initial.cursorExists, "Eraser cursor Graphics object exists and is not destroyed");
  assert(!initial.cursorGeometryEmpty, "Eraser cursor has drawn geometry (is visible)");

  // ── 2. Real scene switch ─────────────────────────────────────────────
  console.log("\n[2] After real scene switch");

  const afterSwitch = await page.evaluate(async () => {
    const layer = canvas.paint;
    const originalSceneId = canvas.scene.id;

    // Switch to Test2 scene then back — uses real pre-existing scenes in the test world
    const test2 = game.scenes.getName("Test2");
    if (!test2) return { error: "Test2 scene not found - please create it in the test world" };
    await test2.view();
    await new Promise(r => setTimeout(r, 3000));

    const originalScene = game.scenes.get(originalSceneId);
    await originalScene.view();
    await new Promise(r => setTimeout(r, 3000));

    // Use fresh canvas.paint reference in case the object identity changed
    const freshLayer = canvas.paint;
    const sameObject = freshLayer === layer;
    const cursorAfterSwitch = freshLayer._eraserCursor;
    const spriteAfterSwitch = freshLayer._sprite;
    const handlersAfterSwitch = canvas.stage.listenerCount("pointermove");

    // Check cursor WITHOUT re-clicking the tool — simulates user staying on erase across scenes
    freshLayer._onStageMove({ getLocalPosition: () => ({ x: 400, y: 400 }) });
    const cursorWithoutReclick = !!freshLayer._eraserCursor && !freshLayer._eraserCursor.destroyed
      && freshLayer._eraserCursor?.geometry?.graphicsData?.length > 0;

    // Now re-select paint + erase (simulates user clicking back)
    document.querySelector('[data-control="foundry-paint"]')?.click();
    await new Promise(r => setTimeout(r, 500));
    document.querySelector('[data-tool="paint-erase"]')?.click();
    await new Promise(r => setTimeout(r, 300));

    const handlersAfterActivate = canvas.stage.listenerCount("pointermove");
    const isErasingAfterReactivate = freshLayer.isErasing;

    freshLayer._onStageMove({ getLocalPosition: () => ({ x: 600, y: 600 }) });

    return {
      sameObject,
      cursorNulledByTeardown: cursorAfterSwitch === null,
      spriteExistsAfterSwitch: !!spriteAfterSwitch && !spriteAfterSwitch?.destroyed,
      handlersAfterSwitch,
      cursorWorksWithoutReclick: cursorWithoutReclick,
      isErasingAfterReactivate,
      handlersAfterActivate,
      cursorExistsAfterMove: !!freshLayer._eraserCursor && !freshLayer._eraserCursor.destroyed,
      cursorGeometryEmpty: freshLayer._eraserCursor?.geometry?.graphicsData?.length === 0,
    };
  });

  assert(afterSwitch.sameObject, "canvas.paint is same object after scene switch (no new instance)");
  assert(afterSwitch.cursorNulledByTeardown, "_eraserCursor nulled by _tearDown");
  assert(afterSwitch.spriteExistsAfterSwitch, "_sprite recreated by initBitmap after scene switch");
  assert(afterSwitch.handlersAfterSwitch > 0,
    `pointermove handler present after switch back (count: ${afterSwitch.handlersAfterSwitch})`);
  assert(afterSwitch.cursorWorksWithoutReclick,
    "Cursor appears on mousemove without manually re-clicking erase tool");
  assert(afterSwitch.isErasingAfterReactivate, "isErasing true after manually re-selecting erase");
  assert(afterSwitch.handlersAfterActivate > 0,
    `pointermove handler registered after re-activation (count: ${afterSwitch.handlersAfterActivate})`);
  assert(afterSwitch.cursorExistsAfterMove, "Cursor exists after pointermove post-redraw");
  assert(!afterSwitch.cursorGeometryEmpty, "Cursor has drawn geometry after pointermove (is visible)");

  console.log("");
  console.log(exitCode === 0 ? "All checks passed." : "Some checks failed.");

  await browser.close();
  process.exit(exitCode);
}

run().catch((e) => {
  console.error("Test error:", e.message);
  process.exit(1);
});
