/**
 * EraserPanel — a small flyout panel that appears to the right of the
 * controls bar when the erase tool is active. Lets the user pick eraser size.
 */

export const ERASER_SIZES = [1, 2, 4, 8];

export class EraserPanel {
  constructor() {
    this._el = null;
  }

  show() {
    this.hide();

    // Find the eraser button to anchor vertically
    const eraserBtn = document.querySelector('[data-tool="paint-erase"]');
    if (!eraserBtn) return;

    const rect = eraserBtn.getBoundingClientRect();
    const currentSize = game.settings.get("foundry-paint", "eraserSize");

    const el = document.createElement("div");
    el.id = "foundry-paint-eraser-panel";
    el.innerHTML = ERASER_SIZES.map(s => `
      <button class="eraser-size-btn ${s === currentSize ? "active" : ""}"
              data-size="${s}" title="${s}×${s} pixels">
        <div class="eraser-size-icon" style="width:${4 + s * 3}px; height:${4 + s * 3}px;"></div>
      </button>
    `).join("");

    el.style.top = `${rect.top}px`;
    document.body.appendChild(el);
    this._el = el;

    // Click handlers
    el.querySelectorAll(".eraser-size-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const size = Number(btn.dataset.size);
        game.settings.set("foundry-paint", "eraserSize", size);
        el.querySelectorAll(".eraser-size-btn").forEach(b => {
          b.classList.toggle("active", Number(b.dataset.size) === size);
        });
        canvas.paint?._updateEraserCursor();
      });
    });
  }

  hide() {
    this._el?.remove();
    this._el = null;
  }

  get visible() {
    return !!this._el;
  }
}
