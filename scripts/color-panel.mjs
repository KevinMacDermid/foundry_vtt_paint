/**
 * ColorPanel — a horizontal flyout showing all colour swatches.
 * Opened/closed by clicking the single colour button in the toolbar.
 */

export const COLORS = [
  { name: "color-black",  title: "Black",  hex: "#000000" },
  { name: "color-white",  title: "White",  hex: "#ffffff" },
  { name: "color-red",    title: "Red",    hex: "#e03030" },
  { name: "color-orange", title: "Orange", hex: "#e07820" },
  { name: "color-yellow", title: "Yellow", hex: "#d4c800" },
  { name: "color-green",  title: "Green",  hex: "#30a030" },
  { name: "color-blue",   title: "Blue",   hex: "#2060e0" },
  { name: "color-purple", title: "Purple", hex: "#9030c0" },
  { name: "color-brown",  title: "Brown",  hex: "#7a4010" },
];

export class ColorPanel {
  constructor() {
    this._el = null;
    this._outsideHandler = null;
  }

  toggle() {
    if (this._el) this.hide();
    else this.show();
  }

  show() {
    this.hide();

    const colorBtn = document.querySelector('[data-tool="paint-color"]');
    if (!colorBtn) return;

    const rect = colorBtn.getBoundingClientRect();
    const currentColor = game.settings.get("foundry-paint", "brushColor");

    const el = document.createElement("div");
    el.id = "foundry-paint-color-panel";
    el.innerHTML = COLORS.map(c => `
      <button class="color-swatch-btn ${c.hex.toLowerCase() === currentColor.toLowerCase() ? "active" : ""}"
              data-hex="${c.hex}" title="${c.title}"
              style="color: ${c.hex}; ${c.hex.toLowerCase() === "#ffffff" ? "text-shadow: 0 0 2px #000;" : ""}">
        <i class="fa-solid fa-circle"></i>
      </button>
    `).join("");

    el.style.top = `${rect.top}px`;
    document.body.appendChild(el);
    this._el = el;

    // Pick a colour and close
    el.querySelectorAll(".color-swatch-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        game.settings.set("foundry-paint", "brushColor", btn.dataset.hex);
        this.updateButton();
        this.hide();
      });
    });

    // Close on outside click
    this._outsideHandler = (e) => {
      if (!el.contains(e.target) && e.target !== colorBtn) this.hide();
    };
    setTimeout(() => document.addEventListener("click", this._outsideHandler), 0);
  }

  hide() {
    this._el?.remove();
    this._el = null;
    if (this._outsideHandler) {
      document.removeEventListener("click", this._outsideHandler);
      this._outsideHandler = null;
    }
  }

  /** Update the single toolbar button to reflect the current colour. */
  updateButton() {
    const btn = document.querySelector('[data-tool="paint-color"]');
    if (!btn) return;
    const color = game.settings.get("foundry-paint", "brushColor");
    btn.style.color = color;
    btn.style.textShadow = color.toLowerCase() === "#ffffff" ? "0 0 2px #000" : "";
  }

  get visible() {
    return !!this._el;
  }
}
