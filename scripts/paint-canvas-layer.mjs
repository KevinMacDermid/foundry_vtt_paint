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
    /** @type {OffscreenCanvas} */
    this._bitmap = null;
    /** @type {OffscreenCanvasRenderingContext2D} */
    this._ctx = null;
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
      ? ui.controls.activeTool
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

    // Create offscreen bitmap
    this._bitmap = new OffscreenCanvas(this.gridW, this.gridH);
    this._ctx = this._bitmap.getContext("2d");
    this._ctx.imageSmoothingEnabled = false;

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

  /** Re-render the offscreen bitmap into the PIXI sprite. */
  _refreshTexture() {
    const scene = canvas.scene;
    const dims = scene.dimensions;
    const sceneX = dims?.sceneX ?? 0;
    const sceneY = dims?.sceneY ?? 0;

    const imageData = this._ctx.getImageData(0, 0, this.gridW, this.gridH);
    const pixels = new Uint8Array(imageData.data.buffer);

    // Destroy old texture
    if (this._sprite?.texture && this._sprite.texture !== PIXI.Texture.EMPTY) {
      this._sprite.texture.destroy(true);
    }

    // Create texture via a temp canvas for compatibility
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = this.gridW;
    tmpCanvas.height = this.gridH;
    const tmpCtx = tmpCanvas.getContext("2d");
    const tmpImg = tmpCtx.createImageData(this.gridW, this.gridH);
    tmpImg.data.set(pixels);
    tmpCtx.putImageData(tmpImg, 0, 0);

    const bt = PIXI.BaseTexture.from(tmpCanvas, { scaleMode: PIXI.SCALE_MODES.NEAREST });
    const texture = new PIXI.Texture(bt);

    if (!this._sprite) {
      this._sprite = new PIXI.Sprite(texture);
      this.addChild(this._sprite);
    } else {
      this._sprite.texture = texture;
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
  }

  /** @override */
  _deactivate() {
    super._deactivate();
    document.body.classList.remove("foundry-paint-draw", "foundry-paint-erase");
  }

  _updateCursor() {
    document.body.classList.toggle("foundry-paint-draw", this.isDrawing);
    document.body.classList.toggle("foundry-paint-erase", this.isErasing);
  }

  // ── Mouse event handlers ─────────────────────────────────────────

  /** @override */
  _canDragLeftStart(user, event) {
    return this._ready && (this.isDrawing || this.isErasing);
  }

  /** @override */
  _onDragLeftStart(event) {
    this._isPainting = true;
    this._paintAtEvent(event);
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
    this._refreshTexture();
    this._saveToScene();
  }

  /** @override */
  _onDragLeftCancel(event) {
    this._isPainting = false;
  }

  /** @override */
  _onClickLeft(event) {
    // Single click — paint one pixel
    if (this._ready && (this.isDrawing || this.isErasing)) {
      this._paintAtEvent(event);
      this._refreshTexture();
      this._saveToScene();
    }
  }

  /** Paint or erase at the event's scene position. */
  _paintAtEvent(event) {
    const scene = canvas.scene;
    const dims = scene.dimensions;
    const sceneX = dims?.sceneX ?? 0;
    const sceneY = dims?.sceneY ?? 0;

    // Get scene-space position from the interaction event
    const pos = event.interactionData?.destination
      ?? event.interactionData?.origin
      ?? event.getLocalPosition?.(canvas.stage)
      ?? { x: 0, y: 0 };

    const px = Math.floor((pos.x - sceneX) / this.pixelSize);
    const py = Math.floor((pos.y - sceneY) / this.pixelSize);

    if (px < 0 || px >= this.gridW || py < 0 || py >= this.gridH) return;

    if (this.isDrawing) {
      const color = game.settings.get("foundry-paint", "brushColor");
      this._ctx.fillStyle = color;
      this._ctx.fillRect(px, py, 1, 1);
    } else if (this.isErasing) {
      this._ctx.clearRect(px, py, 1, 1);
    }

    this._scheduleRefresh();
  }

  // ── Persistence ──────────────────────────────────────────────────

  async _saveToScene() {
    const scene = canvas.scene;
    if (!scene) return;

    const blob = await this._bitmap.convertToBlob({ type: "image/png" });
    const reader = new FileReader();
    const dataUrl = await new Promise((resolve) => {
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });

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
