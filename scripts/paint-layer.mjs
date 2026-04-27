/**
 * PaintLayer — manages a low-res bitmap overlay on the Foundry canvas.
 * Each "pixel" in the bitmap maps to a square of `pixelSize` scene units.
 * The bitmap is rendered as a PIXI Sprite that pans/zooms with the scene.
 *
 * Mouse input is captured via an HTML overlay element to prevent
 * Foundry's canvas from receiving pointer events (no panning while painting).
 */
export class PaintLayer {
  constructor() {
    /** @type {PIXI.Container} */
    this.container = null;
    /** @type {PIXI.Sprite} */
    this.sprite = null;
    /** @type {OffscreenCanvas} */
    this.bitmap = null;
    /** @type {OffscreenCanvasRenderingContext2D} */
    this.ctx = null;
    /** @type {number} grid width in paint-pixels */
    this.gridW = 0;
    /** @type {number} grid height in paint-pixels */
    this.gridH = 0;
    /** @type {number} scene units per paint-pixel */
    this.pixelSize = 20;
    /** @type {boolean} */
    this._painting = false;
    /** @type {string|null} "draw"|"erase" */
    this.tool = null;
    /** @type {HTMLDivElement} */
    this._overlay = null;

    // Bound handlers
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
  }

  /** Initialize (or reinitialize) the paint layer for the current scene. */
  init() {
    this.pixelSize = game.settings.get("foundry-paint", "pixelSize");
    const scene = canvas.scene;
    if (!scene) return;

    const dims = scene.dimensions;
    const sceneW = dims?.sceneWidth ?? scene.width;
    const sceneH = dims?.sceneHeight ?? scene.height;

    this.gridW = Math.ceil(sceneW / this.pixelSize);
    this.gridH = Math.ceil(sceneH / this.pixelSize);

    // Create offscreen bitmap
    this.bitmap = new OffscreenCanvas(this.gridW, this.gridH);
    this.ctx = this.bitmap.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;

    // Build PIXI display objects
    this._buildContainer();

    // Create HTML overlay for event capture
    this._createOverlay();

    // Load saved data if any
    this._loadFromScene();

    console.log(`Foundry Paint | Bitmap ${this.gridW}x${this.gridH} (pixel size: ${this.pixelSize})`);
  }

  /** Rebuild after settings change. */
  rebuild() {
    if (this.container) {
      this.container.destroy({ children: true });
      this.container = null;
      this.sprite = null;
    }
    this.init();
  }

  /** Create the PIXI container and sprite, add to canvas. */
  _buildContainer() {
    if (this.container) {
      this.container.destroy({ children: true });
    }

    this.container = new PIXI.Container();
    this.container.name = "foundry-paint";
    this.container.alpha = game.settings.get("foundry-paint", "opacity");
    this.container.interactive = false;
    this.container.interactiveChildren = false;

    // Create initial sprite
    this._updateTexture();

    // Insert the container into the canvas above drawings but below interface
    const idx = canvas.stage.children.findIndex((c) => c === canvas.interface);
    if (idx >= 0) {
      canvas.stage.addChildAt(this.container, idx);
    } else {
      canvas.stage.addChild(this.container);
    }
  }

  /** Create an HTML overlay div for capturing pointer events. */
  _createOverlay() {
    if (this._overlay) this._overlay.remove();

    this._overlay = document.createElement("div");
    this._overlay.classList.add("foundry-paint-overlay");
    document.body.appendChild(this._overlay);
  }

  /** Re-render the bitmap to the PIXI texture. */
  _updateTexture() {
    const scene = canvas.scene;
    const dims = scene.dimensions;
    const sceneX = dims?.sceneX ?? 0;
    const sceneY = dims?.sceneY ?? 0;

    // Get pixel data from offscreen canvas
    const imageData = this.ctx.getImageData(0, 0, this.gridW, this.gridH);
    const pixels = new Uint8Array(imageData.data.buffer);

    // Destroy old texture if it exists
    if (this.sprite && this.sprite.texture !== PIXI.Texture.EMPTY) {
      this.sprite.texture.destroy(true);
    }

    // Create texture — use fallback canvas approach for compatibility
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = this.gridW;
    tmpCanvas.height = this.gridH;
    const tmpCtx = tmpCanvas.getContext("2d");
    const tmpImg = tmpCtx.createImageData(this.gridW, this.gridH);
    tmpImg.data.set(pixels);
    tmpCtx.putImageData(tmpImg, 0, 0);

    const bt = PIXI.BaseTexture.from(tmpCanvas, { scaleMode: PIXI.SCALE_MODES.NEAREST });
    const texture = new PIXI.Texture(bt);

    if (!this.sprite) {
      this.sprite = new PIXI.Sprite(texture);
      this.container.addChild(this.sprite);
    } else {
      this.sprite.texture = texture;
    }

    // Position and scale the sprite to cover the scene
    this.sprite.x = sceneX;
    this.sprite.y = sceneY;
    this.sprite.width = this.gridW * this.pixelSize;
    this.sprite.height = this.gridH * this.pixelSize;
  }

  // ── Tool activation ──────────────────────────────────────────────

  /** Activate a tool ("draw" or "erase"). */
  activate(tool) {
    this.tool = tool;
    this._addListeners();
    document.body.classList.add("foundry-paint-active");
    document.body.classList.toggle("foundry-paint-draw", tool === "draw");
    document.body.classList.toggle("foundry-paint-erase", tool === "erase");
  }

  /** Deactivate painting. */
  deactivate() {
    this.tool = null;
    this._painting = false;
    this._removeListeners();
    document.body.classList.remove("foundry-paint-active", "foundry-paint-draw", "foundry-paint-erase");
  }

  _addListeners() {
    this._removeListeners();
    if (!this._overlay) return;
    this._overlay.addEventListener("pointerdown", this._onPointerDown);
    this._overlay.addEventListener("pointermove", this._onPointerMove);
    this._overlay.addEventListener("pointerup", this._onPointerUp);
    this._overlay.addEventListener("pointerleave", this._onPointerUp);
  }

  _removeListeners() {
    if (!this._overlay) return;
    this._overlay.removeEventListener("pointerdown", this._onPointerDown);
    this._overlay.removeEventListener("pointermove", this._onPointerMove);
    this._overlay.removeEventListener("pointerup", this._onPointerUp);
    this._overlay.removeEventListener("pointerleave", this._onPointerUp);
  }

  // ── Pointer event handlers ───────────────────────────────────────

  _handlePointerDown(event) {
    if (!this.tool) return;
    if (event.button !== 0) return; // left click only
    this._painting = true;
    this._paintAtScreen(event.clientX, event.clientY);
  }

  _handlePointerMove(event) {
    if (!this._painting) return;
    this._paintAtScreen(event.clientX, event.clientY);
  }

  _handlePointerUp(_event) {
    if (!this._painting) return;
    this._painting = false;
    this._updateTexture();
    this._saveToScene();
  }

  /**
   * Convert screen coordinates to scene coordinates, then to bitmap pixel coords.
   */
  _paintAtScreen(screenX, screenY) {
    const scene = canvas.scene;
    const dims = scene.dimensions;
    const sceneX = dims?.sceneX ?? 0;
    const sceneY = dims?.sceneY ?? 0;

    // Transform screen coords → canvas/scene coords
    const transform = canvas.stage.worldTransform;
    const invTransform = transform.clone().invert();
    const scenePos = invTransform.apply({ x: screenX, y: screenY });

    // Convert to bitmap pixel
    const px = Math.floor((scenePos.x - sceneX) / this.pixelSize);
    const py = Math.floor((scenePos.y - sceneY) / this.pixelSize);

    if (px < 0 || px >= this.gridW || py < 0 || py >= this.gridH) return;

    if (this.tool === "draw") {
      const color = game.settings.get("foundry-paint", "brushColor");
      this.ctx.fillStyle = color;
      this.ctx.fillRect(px, py, 1, 1);
    } else if (this.tool === "erase") {
      this.ctx.clearRect(px, py, 1, 1);
    }

    this._throttledUpdate();
  }

  /** Update the texture at most once per frame while painting. */
  _throttledUpdate() {
    if (this._updatePending) return;
    this._updatePending = true;
    requestAnimationFrame(() => {
      this._updateTexture();
      this._updatePending = false;
    });
  }

  // ── Persistence via scene flags ──────────────────────────────────

  /** Save the bitmap to the current scene's flags as a PNG data URL. */
  async _saveToScene() {
    const scene = canvas.scene;
    if (!scene) return;

    const blob = await this.bitmap.convertToBlob({ type: "image/png" });
    const reader = new FileReader();
    const dataUrl = await new Promise((resolve) => {
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });

    await scene.setFlag("foundry-paint", "bitmap", dataUrl);
    await scene.setFlag("foundry-paint", "pixelSize", this.pixelSize);
    console.log("Foundry Paint | Saved to scene flags");
  }

  /** Load bitmap from the current scene's flags. */
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

    const img = new Image();
    img.onload = () => {
      this.ctx.drawImage(img, 0, 0);
      this._updateTexture();
      console.log("Foundry Paint | Loaded from scene flags");
    };
    img.src = dataUrl;
  }

  /** Clear the entire bitmap. */
  async clear() {
    this.ctx.clearRect(0, 0, this.gridW, this.gridH);
    this._updateTexture();
    await this._saveToScene();
    ui.notifications.info("Foundry Paint | Canvas cleared");
  }
}
