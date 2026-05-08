import { PaintCanvasLayer } from "./paint-canvas-layer.mjs";
import { PaintControls, colorPanel } from "./paint-controls.mjs";
import { EraserPanel } from "./eraser-panel.mjs";
import { BrushSizePanel } from "./brush-size-panel.mjs";
import { installTextToolPatch, deactivatePaintText } from "./text-tool.mjs";

const eraserPanel = new EraserPanel();
const brushSizePanel = new BrushSizePanel();

Hooks.once("init", () => {
  console.log("Foundry Paint | Initializing");

  // Register canvas layer early so it's available when the canvas draws
  CONFIG.Canvas.layers[PaintCanvasLayer.LAYER_NAME] = {
    layerClass: PaintCanvasLayer,
    group: "interface",
  };

  game.settings.register("foundry-paint", "pixelSize", {
    name: "Pixel Size",
    hint: "Size of each paint pixel in scene units. Smaller = higher resolution.",
    scope: "world",
    config: true,
    type: Number,
    default: 5,
    range: { min: 1, max: 100, step: 1 },
    onChange: () => {
      if (canvas.paint) canvas.paint.rebuild();
    },
  });

  game.settings.register("foundry-paint", "brushColor", {
    name: "Brush Color",
    hint: "Default color for the paint brush.",
    scope: "client",
    config: true,
    type: String,
    default: "#000000",
  });

  game.settings.register("foundry-paint", "brushSize", {
    name: "Brush Size",
    hint: "Size of the brush in bitmap pixels.",
    scope: "client",
    config: false,
    type: Number,
    default: 1,
  });

  game.settings.register("foundry-paint", "eraserSize", {
    name: "Eraser Size",
    hint: "Size of the eraser in bitmap pixels.",
    scope: "client",
    config: false,
    type: Number,
    default: 4,
  });

  game.settings.register("foundry-paint", "opacity", {
    name: "Paint Opacity",
    hint: "Opacity of the paint layer (0.0 to 1.0).",
    scope: "world",
    config: true,
    type: Number,
    default: 0.7,
    range: { min: 0.1, max: 1.0, step: 0.1 },
    onChange: (value) => {
      if (canvas.paint?._sprite) canvas.paint._sprite.alpha = value;
    },
  });
});

Hooks.once("ready", () => {
  console.log("Foundry Paint | Module ready");
  installTextToolPatch();
});

// Register scene controls (also registers the canvas layer)
Hooks.on("getSceneControlButtons", (controls) => {
  PaintControls.addControls(controls);
});

// Initialize the bitmap when the canvas is ready
// Reload bitmap when another client updates the scene flags
Hooks.on("updateScene", (scene, delta) => {
  if ( scene.id !== canvas.scene?.id ) return;
  if ( !foundry.utils.hasProperty(delta, "flags.foundry-paint") ) return;
  canvas.paint?._loadFromScene();
});

Hooks.on("canvasReady", () => {
  canvas.paint?.initBitmap();
});

// Update cursor, colour button, and flyout panels when control/tool changes
Hooks.on("renderSceneControls", () => {
  canvas.paint?._updateCursor();
  colorPanel.updateButton();
  _syncColorPanel();
  _syncEraserPanel();
  _syncBrushSizePanel();
  _syncTextTool();
});
Hooks.on("activateSceneControls", () => {
  canvas.paint?._updateCursor();
  colorPanel.updateButton();
  _syncColorPanel();
  _syncEraserPanel();
  _syncBrushSizePanel();
  _syncTextTool();
});

function _syncColorPanel() {
  // Hide the colour flyout when switching away from paint controls entirely
  const onPaint = ui.controls?.control?.name === "foundry-paint";
  if (!onPaint) colorPanel.hide();
}

function _syncTextTool() {
  // Deactivate paint-text mode if the user has moved off drawings/text
  const onDrawingsText = ui.controls?.control?.name === "drawings"
    && ui.controls?.tool?.name === "text";
  if (!onDrawingsText) deactivatePaintText();
}

function _syncEraserPanel() {
  const isErasing = ui.controls?.control?.name === "foundry-paint"
    && ui.controls?.tool?.name === "paint-erase";
  if (isErasing) eraserPanel.show();
  else eraserPanel.hide();
}

function _syncBrushSizePanel() {
  const tool = ui.controls?.control?.name === "foundry-paint"
    ? ui.controls?.tool?.name
    : null;
  const showPanel = tool === "paint-draw" || tool === "paint-line";
  if (showPanel) brushSizePanel.show();
  else brushSizePanel.hide();
}
