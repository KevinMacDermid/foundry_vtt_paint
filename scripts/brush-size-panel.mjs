/**
 * BrushSizePanel — a small flyout panel that appears to the right of the
 * controls bar when the draw or line tool is active. Lets the user pick brush size.
 */

export const BRUSH_SIZES = [1, 2, 3];

export class BrushSizePanel {
  constructor() {
    this._el = null;
  }

  show() {
    this.hide();

    // Anchor vertically to the draw button
    const drawBtn = document.querySelector('[data-tool="paint-draw"]');
    if (!drawBtn) return;

    const rect = drawBtn.getBoundingClientRect();
    const currentSize = game.settings.get("foundry-paint", "brushSize");

    const el = document.createElement("div");
    el.id = "foundry-paint-brush-panel";
    const visualSizes = [6, 12, 18];
    el.innerHTML = BRUSH_SIZES.map((s, i) => `
      <button class="brush-size-btn ${s === currentSize ? "active" : ""}"
              data-size="${s}" title="${s}×${s} pixels">
        <div class="brush-size-icon" style="width:${visualSizes[i]}px; height:${visualSizes[i]}px;"></div>
      </button>
    `).join("");

    el.style.top = `${rect.top}px`;
    document.body.appendChild(el);
    this._el = el;

    el.querySelectorAll(".brush-size-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const size = Number(btn.dataset.size);
        game.settings.set("foundry-paint", "brushSize", size);
        el.querySelectorAll(".brush-size-btn").forEach(b => {
          b.classList.toggle("active", Number(b.dataset.size) === size);
        });
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
