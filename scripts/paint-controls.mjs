/**
 * PaintControls — adds Draw / Erase / Clear + color swatch buttons.
 */
import { PaintCanvasLayer } from "./paint-canvas-layer.mjs";

export const COLORS = [
  { name: "color-black",  title: "Black",  hex: "#000000" },
  { name: "color-white",  title: "White",  hex: "#ffffff" },
  { name: "color-red",    title: "Red",    hex: "#e03030" },
  { name: "color-orange", title: "Orange", hex: "#e07820" },
  { name: "color-yellow", title: "Yellow", hex: "#d4c800" },
  { name: "color-green",  title: "Green",  hex: "#30a030" },
  { name: "color-blue",   title: "Blue",   hex: "#2060e0" },
  { name: "color-purple", title: "Purple", hex: "#9030c0" },
];

export class PaintControls {
  static addControls(controls) {
    const colorTools = {};
    COLORS.forEach((c, i) => {
      colorTools[c.name] = {
        name: c.name,
        title: c.title,
        icon: "fa-solid fa-circle",
        order: 10 + i,
        button: true,
        onClick: () => PaintControls._setColor(c.hex),
      };
    });

    controls["foundry-paint"] = {
      name: "foundry-paint",
      title: "Paint Tools",
      layer: PaintCanvasLayer.LAYER_NAME,
      icon: "fa-solid fa-palette",
      order: 100,
      tools: {
        "paint-draw": {
          name: "paint-draw",
          title: "Draw",
          icon: "fa-solid fa-paintbrush",
          order: 1,
        },
        "paint-line": {
          name: "paint-line",
          title: "Line (H/V) — click chain, Esc/RMB to end",
          icon: "fa-solid fa-turn-down",
          order: 2,
        },
        "paint-erase": {
          name: "paint-erase",
          title: "Erase",
          icon: "fa-solid fa-eraser",
          order: 3,
        },
        "paint-clear": {
          name: "paint-clear",
          title: "Clear All",
          icon: "fa-solid fa-trash",
          order: 4,
          button: true,
          onClick: () => PaintControls._clearAll(),
        },
        ...colorTools,
      },
      activeTool: "paint-draw",
      onChange: (event, active) => {
        if (active) canvas.paint?.activate();
      },
    };
  }

  static _setColor(hex) {
    game.settings.set("foundry-paint", "brushColor", hex);
    PaintControls.updateColorButtons();
  }

  /** Highlight the active color button and set its border to show selection. */
  static updateColorButtons() {
    const active = game.settings.get("foundry-paint", "brushColor");
    for (const c of COLORS) {
      const btn = document.querySelector(`[data-tool="${c.name}"]`);
      if (!btn) continue;
      const isActive = c.hex.toLowerCase() === active.toLowerCase();
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    }
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
