/**
 * PaintCanvasLayer — a proper Foundry InteractionLayer that handles
 * bitmap painting. Registering as a canvas layer gives us built-in
 * tool switching, mouse event handling, and button highlighting for free.
 */
export class PaintCanvasLayer extends foundry.canvas.layers.InteractionLayer {
  static LAYER_NAME = "paint";

  constructor() {
    super();
    /** @type {PIXI.Sprite} */
    this._sprite = null;
    /** @type {HTMLCanvasElement} */
    this._bitmap = null;
    /** @type {CanvasRenderingContext2D} */
    this._ctx = null;
    /** @type {PIXI.BaseTexture|null} persistent base texture (updated in place each frame) */
    this._baseTexture = null;
    /** @type {number} */
    this.gridW = 0;
    /** @type {number} */
    this.gridH = 0;
    /** @type {number} */
    this.pixelSize = 20;
    /** @type {boolean} */
    this._isPainting = false;
    /** @type {boolean} true once any saved bitmap is loaded (or no data to load) */
    this._ready = true;
    /** @type {number|null} last painted bitmap x coordinate, for interpolation */
    this._lastPx = null;
    /** @type {number|null} last painted bitmap y coordinate, for interpolation */
    this._lastPy = null;
    /** @type {PIXI.Graphics|null} eraser footprint cursor */
    this._eraserCursor = null;
    /** Bound pointermove handler for eraser cursor */
    this._onStageMoveHandler = this._onStageMove.bind(this);
    /** Safety-net: clear stroke state on any pointerup so strokes never bleed across lifts */
    this._onPointerUpHandler = () => {
      this._isPainting = false;
      this._lastPx = null;
      this._lastPy = null;
    };
    /** @type {{px:number,py:number}|null} line-tool start point (bitmap coords) */
    this._lineStart = null;
    /** @type {PIXI.Graphics|null} line-tool ghost preview */
    this._linePreview = null;
    /** Bound pointermove handler for line preview */
    this._onLinePreviewMoveHandler = this._onLinePreviewMove.bind(this);
    /** Bound keydown handler to cancel line chain via Escape */
    this._onLineKeydownHandler = this._onLineKeydown.bind(this);
  }

  /** @override */
  static get layerOptions() {
    return foundry.utils.mergeObject(super.layerOptions, {
      name: PaintCanvasLayer.LAYER_NAME,
      zIndex: 350, // above drawings (300), below tokens (400)
    });
  }

  /** The currently active paint tool name, e.g. "paint-draw" or "paint-erase". */
  get activeTool() {
    return ui.controls?.control?.name === "foundry-paint"
      ? ui.controls.tool?.name
      : null;
  }

  /** Whether we're in draw mode. */
  get isDrawing() {
    return this.activeTool === "paint-draw";
  }

  /** Whether we're in erase mode. */
  get isErasing() {
    return this.activeTool === "paint-erase";
  }

  /** Whether we're in line mode. */
  get isLine() {
    return this.activeTool === "paint-line";
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  /** @override */
  async _draw(options) {
    // Called by Foundry each time the canvas (re)draws this layer.
    // We reset sprite state here so initBitmap() always starts clean.
    this._sprite = null;
    this._bitmap = null;
    this._ctx = null;
    this.gridW = 0;
    this.gridH = 0;
  }

  /**
   * Initialize the bitmap and sprite for the current scene.
   * Called from canvasReady hook.
   */
  initBitmap() {
    this.pixelSize = game.settings.get("foundry-paint", "pixelSize");
    const scene = canvas.scene;
    if (!scene) return;

    const dims = scene.dimensions;
    const sceneW = dims?.sceneWidth ?? scene.width;
    const sceneH = dims?.sceneHeight ?? scene.height;

    this.gridW = Math.ceil(sceneW / this.pixelSize);
    this.gridH = Math.ceil(sceneH / this.pixelSize);

    // Create bitmap canvas
    this._bitmap = document.createElement("canvas");
    this._bitmap.width = this.gridW;
    this._bitmap.height = this.gridH;
    this._ctx = this._bitmap.getContext("2d");
    this._ctx.imageSmoothingEnabled = false;
    this._baseTexture = null;

    // Build the PIXI sprite
    this._ready = true; // assume ready; _loadFromScene may set false temporarily
    this._buildSprite();

    // Load saved data (may set _ready=false until image loads)
    this._loadFromScene();

    console.log(`Foundry Paint | Bitmap ${this.gridW}×${this.gridH} (pixel size: ${this.pixelSize})`);
  }

  /** Rebuild after settings change. */
  rebuild() {
    this._sprite = null;
    this._bitmap = null;
    this._ctx = null;
    this._baseTexture = null;
    this.gridW = 0;
    this.gridH = 0;
    this.initBitmap();
  }

  _buildSprite() {
    if (this._sprite) {
      this._sprite.destroy({ children: true });
      this._sprite = null;
    }

    this._refreshTexture();

    const opacity = game.settings.get("foundry-paint", "opacity");
    this._sprite.alpha = opacity;
  }

  // ── Texture ──────────────────────────────────────────────────────

  /** Re-render the bitmap into the PIXI sprite. First call creates the texture; subsequent calls just update it in place. */
  _refreshTexture() {
    const scene = canvas.scene;
    const dims = scene.dimensions;
    const sceneX = dims?.sceneX ?? 0;
    const sceneY = dims?.sceneY ?? 0;

    if (!this._baseTexture) {
      // First time: create a BaseTexture from our canvas and keep it forever
      this._baseTexture = PIXI.BaseTexture.from(this._bitmap, { scaleMode: PIXI.SCALE_MODES.NEAREST });
      const texture = new PIXI.Texture(this._baseTexture);
      if (!this._sprite) {
        this._sprite = new PIXI.Sprite(texture);
        this.addChild(this._sprite);
      } else {
        this._sprite.texture = texture;
      }
    } else {
      // Subsequent frames: just push the updated canvas pixels to the GPU
      this._baseTexture.update();
    }

    this._sprite.x = sceneX;
    this._sprite.y = sceneY;
    this._sprite.width = this.gridW * this.pixelSize;
    this._sprite.height = this.gridH * this.pixelSize;
  }

  /** Throttled texture refresh — at most once per frame. */
  _scheduleRefresh() {
    if (this._refreshPending) return;
    this._refreshPending = true;
    requestAnimationFrame(() => {
      this._refreshTexture();
      this._refreshPending = false;
    });
  }

  // ── Cursor ───────────────────────────────────────────────────────

  /** @override */
  _activate() {
    super._activate();
    this.interactive = true;
    this.interactiveChildren = true;
    this._updateCursor();
    canvas.stage.on("pointermove", this._onStageMoveHandler);
    window.addEventListener("pointerup", this._onPointerUpHandler);
  }

  /** @override */
  _deactivate() {
    super._deactivate();
    document.body.classList.remove("foundry-paint-draw", "foundry-paint-erase", "foundry-paint-line");
    canvas.stage.off("pointermove", this._onStageMoveHandler);
    window.removeEventListener("pointerup", this._onPointerUpHandler);
    this._cancelLineChain();
    this._eraserCursor?.clear();
  }

  _updateCursor() {
    document.body.classList.toggle("foundry-paint-draw", this.isDrawing);
    document.body.classList.toggle("foundry-paint-erase", this.isErasing);
    document.body.classList.toggle("foundry-paint-line", this.isLine);
    if (!this.isErasing) this._eraserCursor?.clear();
    // Cancel any in-progress line chain if we switched away from the line tool
    if (!this.isLine) this._cancelLineChain();
  }

  // ── Eraser cursor ────────────────────────────────────────────────

  /** Ensure the eraser cursor Graphics object exists in this layer. */
  _ensureEraserCursor() {
    if (!this._eraserCursor || this._eraserCursor.destroyed) {
      this._eraserCursor = new PIXI.Graphics();
      this.addChild(this._eraserCursor);
    }
    return this._eraserCursor;
  }

  /** Called on canvas.stage pointermove — update eraser footprint. */
  _onStageMove(event) {
    if (!this.isErasing) return;
    const pos = event.getLocalPosition(canvas.stage);
    this._drawEraserCursor(pos.x, pos.y);
  }

  /** Draw (or update) the eraser footprint rectangle at scene position (sx, sy). */
  _drawEraserCursor(sx, sy) {
    const scene = canvas.scene;
    const dims = scene.dimensions;
    const sceneX = dims?.sceneX ?? 0;
    const sceneY = dims?.sceneY ?? 0;
    const size = game.settings.get("foundry-paint", "eraserSize");

    // Snap to bitmap pixel grid
    const px = Math.floor((sx - sceneX) / this.pixelSize);
    const py = Math.floor((sy - sceneY) / this.pixelSize);
    const half = Math.floor(size / 2);
    const bx = px - half;
    const by = py - half;

    // Convert back to scene coords for drawing
    const rx = sceneX + bx * this.pixelSize;
    const ry = sceneY + by * this.pixelSize;
    const rw = size * this.pixelSize;
    const rh = size * this.pixelSize;

    const g = this._ensureEraserCursor();
    g.clear();
    // White fill with dark outline — MSPaint style
    g.beginFill(0xffffff, 0.35);
    g.lineStyle(1, 0x000000, 0.8);
    g.drawRect(rx, ry, rw, rh);
    g.endFill();
    // Inner white border for visibility on dark backgrounds
    g.lineStyle(1, 0xffffff, 0.8);
    g.drawRect(rx + 1, ry + 1, rw - 2, rh - 2);
  }

  /** Force a cursor redraw at the last known mouse position (e.g. after size change). */
  _updateEraserCursor() {
    // Redrawn on next pointermove — just clear for now
    this._eraserCursor?.clear();
  }

  // ── Mouse event handlers ─────────────────────────────────────────

  /** @override */
  _canDragLeftStart(user, event) {
    return this._ready && (this.isDrawing || this.isErasing);
  }

  /** @override */
  _onDragLeftStart(event) {
    this._isPainting = true;
    this._lastPx = null;
    this._lastPy = null;
    // Cache colour for stroke consistency; sizes are read fresh each event (cheap + avoids stale values)
    this._strokeColor = game.settings.get("foundry-paint", "brushColor");
    // Paint at origin (actual click point) first, then destination if different
    this._paintAtEvent(event, true);
  }

  /** @override */
  _onDragLeftMove(event) {
    if (!this._isPainting) return;
    this._paintAtEvent(event);
  }

  /** @override */
  _onDragLeftDrop(event) {
    if (!this._isPainting) return;
    this._isPainting = false;
    this._lastPx = null;
    this._lastPy = null;
    this._refreshTexture();
    this._saveToScene();
  }

  /** @override */
  _onDragLeftCancel(event) {
    this._isPainting = false;
    this._lastPx = null;
    this._lastPy = null;
  }

  /** @override */
  _onClickLeft(event) {
    if (this._ready && this.isLine) {
      this._handleLineClick(event);
      return;
    }
    // Single click — paint one pixel
    if (this._ready && (this.isDrawing || this.isErasing)) {
      this._paintAtEvent(event);
      this._refreshTexture();
      this._saveToScene();
    }
  }

  /** @override */
  _onClickRight(event) {
    // Right-click ends the line chain
    this._cancelLineChain();
  }

  // ── Line tool ────────────────────────────────────────────────────

  /** First click sets start; every subsequent click commits a segment and chains the next. Esc/RMB ends the chain. */
  _handleLineClick(event) {
    const { px, py } = this._eventToBitmapCoords(event);
    if (px === null) return;

    if (!this._lineStart) {
      // First click — begin chain, register preview + keydown listeners
      this._lineStart = { px, py };
      canvas.stage.on("pointermove", this._onLinePreviewMoveHandler);
      document.addEventListener("keydown", this._onLineKeydownHandler);
      // Show a dot at the start point immediately
      this._updateLinePreview(px, py);
    } else {
      // Next click — commit this segment, then chain: endpoint becomes new start
      const { px: x0, py: y0 } = this._lineStart;
      const [x1, y1] = this._snapToAxis(x0, y0, px, py);

      const color = game.settings.get("foundry-paint", "brushColor");
      const size = game.settings.get("foundry-paint", "brushSize");
      const half = Math.floor(size / 2);
      this._ctx.fillStyle = color;
      for (const [bx, by] of this._bresenham(x0, y0, x1, y1)) {
        this._ctx.fillRect(bx - half, by - half, size, size);
      }
      this._refreshTexture();
      this._saveToScene();

      // Chain: the endpoint is now the start of the next segment
      this._lineStart = { px: x1, py: y1 };
      // Clear preview so it redraws cleanly on next mousemove
      this._linePreview?.clear();
    }
  }

  /** Cancel / end the active line chain (Esc or right-click). */
  _cancelLineChain() {
    if (this._lineStart === null) return;
    this._lineStart = null;
    this._linePreview?.clear();
    canvas.stage.off("pointermove", this._onLinePreviewMoveHandler);
    document.removeEventListener("keydown", this._onLineKeydownHandler);
  }

  /** Keydown handler — Escape ends the line chain. */
  _onLineKeydown(event) {
    if (event.key === "Escape") this._cancelLineChain();
  }

  /**
   * Snap (x1,y1) to a horizontal or vertical line from (x0,y0).
   * The dominant axis wins; ties go horizontal.
   */
  _snapToAxis(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    return dx >= dy ? [x1, y0] : [x0, y1];
  }

  /** Pointermove handler — updates the ghost line preview while placing a line. */
  _onLinePreviewMove(event) {
    if (!this._lineStart || !this.isLine) return;
    const scene = canvas.scene;
    const dims = scene.dimensions;
    const sceneX = dims?.sceneX ?? 0;
    const sceneY = dims?.sceneY ?? 0;
    const pos = event.getLocalPosition(canvas.stage);
    const px = Math.floor((pos.x - sceneX) / this.pixelSize);
    const py = Math.floor((pos.y - sceneY) / this.pixelSize);
    this._updateLinePreview(px, py);
  }

  /** Redraw the ghost preview from _lineStart to (px, py), snapped to H/V. */
  _updateLinePreview(px, py) {
    const scene = canvas.scene;
    const dims = scene.dimensions;
    const sceneX = dims?.sceneX ?? 0;
    const sceneY = dims?.sceneY ?? 0;

    if (!this._linePreview || this._linePreview.destroyed) {
      this._linePreview = new PIXI.Graphics();
      this.addChild(this._linePreview);
    }

    const g = this._linePreview;
    g.clear();

    const color = game.settings.get("foundry-paint", "brushColor");
    const colorInt = parseInt(color.replace("#", ""), 16);
    const ps = this.pixelSize;

    // If no start yet, just draw the hover dot (shouldn't normally be called)
    if (!this._lineStart) return;

    const { px: x0, py: y0 } = this._lineStart;
    const [x1, y1] = this._snapToAxis(x0, y0, px, py);

    // Ghost line — brush colour at 50% opacity
    g.beginFill(colorInt, 0.5);
    for (const [bx, by] of this._bresenham(x0, y0, x1, y1)) {
      g.drawRect(sceneX + bx * ps, sceneY + by * ps, ps, ps);
    }
    g.endFill();

    // Start-point marker — white ring so it's visible on any colour
    g.lineStyle(1, 0xffffff, 0.9);
    g.beginFill(colorInt, 0.9);
    g.drawRect(sceneX + x0 * ps, sceneY + y0 * ps, ps, ps);
    g.endFill();
    g.lineStyle(0);
  }

  /**
   * Convert an interaction event to bitmap pixel coordinates.
   * Returns { px, py } — both null if out of bounds.
   */
  _eventToBitmapCoords(event) {
    const scene = canvas.scene;
    const dims = scene.dimensions;
    const sceneX = dims?.sceneX ?? 0;
    const sceneY = dims?.sceneY ?? 0;
    const pos = event.interactionData?.destination
      ?? event.interactionData?.origin
      ?? event.getLocalPosition?.(canvas.stage)
      ?? { x: 0, y: 0 };
    const px = Math.floor((pos.x - sceneX) / this.pixelSize);
    const py = Math.floor((pos.y - sceneY) / this.pixelSize);
    if (px < 0 || px >= this.gridW || py < 0 || py >= this.gridH)
      return { px: null, py: null };
    return { px, py };
  }

  /**
   * Paint or erase at the event's scene position, interpolating from last position.
   * @param {Event} event
   * @param {boolean} [useOrigin=false] prefer interactionData.origin over destination (drag start)
   */
  _paintAtEvent(event, useOrigin = false) {
    const scene = canvas.scene;
    const dims = scene.dimensions;
    const sceneX = dims?.sceneX ?? 0;
    const sceneY = dims?.sceneY ?? 0;

    // At drag start, prefer origin (actual click point); during drag, prefer destination
    const pos = useOrigin
      ? (event.interactionData?.origin ?? event.interactionData?.destination ?? event.getLocalPosition?.(canvas.stage) ?? { x: 0, y: 0 })
      : (event.interactionData?.destination ?? event.interactionData?.origin ?? event.getLocalPosition?.(canvas.stage) ?? { x: 0, y: 0 });

    const px = Math.floor((pos.x - sceneX) / this.pixelSize);
    const py = Math.floor((pos.y - sceneY) / this.pixelSize);

    if (px < 0 || px >= this.gridW || py < 0 || py >= this.gridH) {
      this._lastPx = null;
      this._lastPy = null;
      return;
    }

    // Interpolate from last position to current to fill gaps
    const x0 = this._lastPx ?? px;
    const y0 = this._lastPy ?? py;
    this._lastPx = px;
    this._lastPy = py;

    if (this.isDrawing) {
      // Use cached settings from stroke start to avoid per-event settings reads
      const color = this._strokeColor ?? game.settings.get("foundry-paint", "brushColor");
      const size = game.settings.get("foundry-paint", "brushSize");
      const half = Math.floor(size / 2);
      this._ctx.fillStyle = color;
      for (const [bx, by] of this._bresenham(x0, y0, px, py)) {
        this._ctx.fillRect(bx - half, by - half, size, size);
      }
    } else if (this.isErasing) {
      const size = game.settings.get("foundry-paint", "eraserSize");
      const half = Math.floor(size / 2);
      for (const [bx, by] of this._bresenham(x0, y0, px, py)) {
        this._ctx.clearRect(bx - half, by - half, size, size);
      }
    }

    this._scheduleRefresh();
  }

  /**
   * Yields all [x, y] bitmap coordinates on the line from (x0,y0) to (x1,y1)
   * using Bresenham's line algorithm.
   */
  *_bresenham(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      yield [x0, y0];
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // ── Persistence ──────────────────────────────────────────────────

  async _saveToScene() {
    const scene = canvas.scene;
    if (!scene) return;

    const dataUrl = this._bitmap.toDataURL("image/png");

    await scene.setFlag("foundry-paint", "bitmap", dataUrl);
    await scene.setFlag("foundry-paint", "pixelSize", this.pixelSize);
    console.log("Foundry Paint | Saved to scene flags");
  }

  _loadFromScene() {
    const scene = canvas.scene;
    if (!scene) return;

    const dataUrl = scene.getFlag("foundry-paint", "bitmap");
    const savedPixelSize = scene.getFlag("foundry-paint", "pixelSize");

    if (!dataUrl) return;

    if (savedPixelSize && savedPixelSize !== this.pixelSize) {
      console.log("Foundry Paint | Pixel size changed, starting fresh");
      return;
    }

    // Block painting until the saved image has loaded, so async load
    // can't clobber new strokes and there's no perceived lag.
    this._ready = false;
    const img = new Image();
    img.onload = () => {
      this._ctx.drawImage(img, 0, 0);
      this._ready = true;
      this._refreshTexture();
      console.log("Foundry Paint | Loaded from scene flags");
    };
    img.onerror = () => {
      this._ready = true; // unblock even on error
    };
    img.src = dataUrl;
  }

  async clear() {
    this._ctx.clearRect(0, 0, this.gridW, this.gridH);
    this._refreshTexture();
    await this._saveToScene();
    ui.notifications.info("Foundry Paint | Canvas cleared");
  }
}
