/**
 * PaintControls — adds Draw / Erase / Clear + a single colour picker button.
 */
import { PaintCanvasLayer } from "./paint-canvas-layer.mjs";
import { ColorPanel } from "./color-panel.mjs";
import { activatePaintText } from "./text-tool.mjs";

export const colorPanel = new ColorPanel();

export class PaintControls {
  static addControls(controls) {
    controls["foundry-paint"] = {
      name: "foundry-paint",
      title: "Paint Tools",
      layer: PaintCanvasLayer.LAYER_NAME,
      icon: "fa-solid fa-palette",
      order: 100,
      tools: {
        "paint-draw": {
          name: "paint-draw",
          title: "Freehand Draw",
          icon: "fa-solid fa-paintbrush",
          order: 1,
        },
        "paint-line": {
          name: "paint-line",
          title: "Grid Lines — click chain, Esc/RMB to end",
          icon: "fa-solid fa-minus",
          order: 2,
        },
        "paint-erase": {
          name: "paint-erase",
          title: "Erase",
          icon: "fa-solid fa-eraser",
          order: 3,
        },
        "paint-text": {
          name: "paint-text",
          title: "Text (uses brush colour)",
          icon: "fa-solid fa-font",
          order: 4,
          button: true,
          onClick: () => activatePaintText(),
        },
        "paint-color": {
          name: "paint-color",
          title: "Colour",
          icon: "fa-solid fa-circle",
          order: 4,
          button: true,
          onClick: () => colorPanel.toggle(),
        },
        "paint-clear": {
          name: "paint-clear",
          title: "Clear All",
          icon: "fa-solid fa-trash",
          order: 5,
          button: true,
          onClick: () => PaintControls._clearAll(),
        },
      },
      activeTool: "paint-draw",
      onChange: (event, active) => {
        if (active) canvas.paint?.activate();
      },
    };
  }

  static async _clearAll() {
    if (!canvas.paint) return;
    const confirm = await Dialog.confirm({
      title: "Clear Paint",
      content: "<p>Clear all paint from this scene?</p>",
    });
    if (confirm) {
      await canvas.paint.clear();
    }
  }
}
