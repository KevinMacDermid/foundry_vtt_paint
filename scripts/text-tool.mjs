/**
 * text-tool.mjs — wires the paint-text button to Foundry's built-in text
 * drawing tool, injecting the active brush colour and suppressing the border.
 */

let _active = false;
let _color  = "#000000";

/** True while the user is in paint-text mode (drawings layer, text tool). */
export function isPaintTextActive() { return _active; }

/**
 * Switch to the drawings layer text tool, using the current brush colour.
 * Call this from the paint-text button's onClick.
 */
export function activatePaintText() {
  _color  = game.settings.get("foundry-paint", "brushColor");
  _active = true;

  // Persist textColor + no-border into Foundry's drawing defaults so the
  // DrawingConfig panel reflects our choices too.
  const key      = foundry.canvas.layers.DrawingsLayer.DEFAULT_CONFIG_SETTING;
  const defaults = game.settings.get("core", key) ?? {};
  game.settings.set("core", key, { ...defaults, textColor: _color, strokeWidth: 0 });

  // Hand off to Foundry's drawings layer, text tool.
  ui.controls.activate({ control: "drawings", tool: "text" });
}

/** Call when the user leaves drawings/text — clears our flag. */
export function deactivatePaintText() {
  _active = false;
}

/**
 * Patch DrawingsLayer._getNewDrawingData once at startup so that whenever
 * paint-text mode is active the created drawing gets:
 *   - textColor  = our brush colour
 *   - strokeWidth = 0   (no border)
 *   - fillAlpha   = 0   (no background box — the text tool hardcodes 0.10 otherwise)
 */
export function installTextToolPatch() {
  const proto = foundry.canvas.layers.DrawingsLayer.prototype;
  const _orig = proto._getNewDrawingData;

  proto._getNewDrawingData = function (origin) {
    const data = _orig.call(this, origin);
    if (_active && game.activeTool === "text") {
      data.textColor   = _color;
      data.strokeWidth = 0;
      // fillAlpha intentionally left at Foundry's default (0.10) — Foundry requires
      // visible text, fill, OR line at creation time; text is empty until the user types.
    }
    return data;
  };
}
