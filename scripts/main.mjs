import { PaintCanvasLayer } from "./paint-canvas-layer.mjs";
import { PaintControls } from "./paint-controls.mjs";

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
    default: 20,
    range: { min: 5, max: 100, step: 5 },
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
    default: "#ff0000",
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
});

// Register scene controls (also registers the canvas layer)
Hooks.on("getSceneControlButtons", (controls) => {
  PaintControls.addControls(controls);
});

// Initialize the bitmap when the canvas is ready
Hooks.on("canvasReady", () => {
  canvas.paint?.initBitmap();
});

// Update cursor when tool changes
Hooks.on("renderSceneControls", () => {
  canvas.paint?._updateCursor();
});
