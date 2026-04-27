import { PaintLayer } from "./paint-layer.mjs";
import { PaintControls } from "./paint-controls.mjs";

Hooks.once("init", () => {
  console.log("Foundry Paint | Initializing");

  // Register settings
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
    }
  });

  game.settings.register("foundry-paint", "brushColor", {
    name: "Brush Color",
    hint: "Default color for the paint brush.",
    scope: "client",
    config: true,
    type: String,
    default: "#ff0000"
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
      if (canvas.paint) canvas.paint.container.alpha = value;
    }
  });
});

Hooks.once("ready", () => {
  console.log("Foundry Paint | Module ready");
});

// Add paint layer to the canvas
Hooks.on("canvasInit", (canvas) => {
  canvas.paint = new PaintLayer();
});

Hooks.on("canvasReady", (canvas) => {
  canvas.paint.init();
});

// Add scene control buttons
Hooks.on("getSceneControlButtons", (controls) => {
  PaintControls.addControls(controls);
});

// Watch for tool/control changes to activate/deactivate painting
Hooks.on("renderSceneControls", (app) => {
  const control = app.control;
  if (control?.name === "foundry-paint") {
    const tool = control.activeTool;
    if (tool === "paint-draw") {
      canvas.paint?.activate("draw");
    } else if (tool === "paint-erase") {
      canvas.paint?.activate("erase");
    }
  } else {
    canvas.paint?.deactivate();
  }
});
