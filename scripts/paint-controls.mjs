/**
 * PaintControls — adds Draw / Erase / Clear buttons to Foundry's scene controls.
 * We wire up click handlers directly on rendered DOM elements since our
 * control group has no canvas layer for Foundry's built-in tool switching.
 */
export class PaintControls {
  static activeTool = null;

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

  /** Called from renderSceneControls hook. */
  static onRender(app) {
    if (app.control?.name !== "foundry-paint") {
      PaintControls.activeTool = null;
      canvas.paint?.deactivate();
      return;
    }

    // Wire click handlers on the tool buttons after render
    requestAnimationFrame(() => {
      const drawBtn = document.querySelector('[data-tool="paint-draw"]');
      const eraseBtn = document.querySelector('[data-tool="paint-erase"]');

      drawBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        PaintControls._setTool("draw");
      }, { capture: true });

      eraseBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        PaintControls._setTool("erase");
      }, { capture: true });

      PaintControls._updateButtons();

      // If no tool selected yet, default to draw
      if (!PaintControls.activeTool) {
        PaintControls._setTool("draw");
      } else {
        canvas.paint?.activate(PaintControls.activeTool);
      }
    });
  }

  static _setTool(tool) {
    if (!canvas.paint) return;

    if (PaintControls.activeTool === tool) {
      // Toggle off
      PaintControls.activeTool = null;
      canvas.paint.deactivate();
    } else {
      PaintControls.activeTool = tool;
      canvas.paint.activate(tool);
    }
    PaintControls._updateButtons();
  }

  static _updateButtons() {
    const drawBtn = document.querySelector('[data-tool="paint-draw"]');
    const eraseBtn = document.querySelector('[data-tool="paint-erase"]');
    drawBtn?.classList.toggle("active", PaintControls.activeTool === "draw");
    eraseBtn?.classList.toggle("active", PaintControls.activeTool === "erase");
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
