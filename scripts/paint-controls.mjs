/**
 * PaintControls — adds Draw / Erase / Clear buttons to Foundry's scene controls.
 * Foundry v13 uses object-keyed controls and tools, not arrays.
 */
export class PaintControls {
  static _activeTool = null;

  static addControls(controls) {
    controls["foundry-paint"] = {
      name: "foundry-paint",
      title: "Paint Tools",
      icon: "fa-solid fa-palette",
      order: 100,
      tools: {
        "paint-draw": {
          name: "paint-draw",
          title: "Draw",
          icon: "fa-solid fa-paintbrush",
          order: 1
        },
        "paint-erase": {
          name: "paint-erase",
          title: "Erase",
          icon: "fa-solid fa-eraser",
          order: 2
        },
        "paint-clear": {
          name: "paint-clear",
          title: "Clear All",
          icon: "fa-solid fa-trash",
          order: 3,
          button: true,
          onClick: () => PaintControls._clearAll()
        }
      },
      activeTool: "paint-draw"
    };
  }

  static async _clearAll() {
    if (!canvas.paint) return;
    const confirm = await Dialog.confirm({
      title: "Clear Paint",
      content: "<p>Clear all paint from this scene?</p>"
    });
    if (confirm) {
      await canvas.paint.clear();
    }
  }
}
