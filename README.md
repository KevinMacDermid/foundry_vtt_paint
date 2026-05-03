# Foundry Paint

A freehand painting and drawing module for [Foundry VTT](https://foundryvtt.com/) v13.

## Features

- **Draw tool** — freehand brush painting directly on the canvas
- **Line tool** — click to start a chain of horizontal/vertical lines; Esc or right-click to end
- **Erase tool** — erase painted areas with a configurable eraser size
- **Brush sizes** — small, medium, and large brush sizes for draw and line tools
- **Color swatches** — quickly switch between 8 preset colours (black, white, red, orange, yellow, green, blue, purple)
- **Opacity control** — adjust the opacity of the paint layer per scene
- **Persistence** — paintings are saved to scene flags and survive reloads
- **Clear** — wipe the paint layer for the current scene with a confirmation dialog

## Installation

1. In Foundry VTT, go to **Add-on Modules → Install Module**
2. Paste the manifest URL:
   ```
   https://raw.githubusercontent.com/KevinMacDermid/foundry_vtt_paint/main/module.json
   ```
3. Click **Install**, then enable the module in your world

## Usage

1. Activate the **Paint** control group (palette icon in the scene controls sidebar)
2. Pick a colour swatch, then select a tool:
   - **Draw** — click and drag to paint freehand
   - **Line** — click to place a start point, click again to draw a snapped H/V segment; each endpoint chains into the next line; Esc or right-click to finish
   - **Erase** — click and drag to erase
3. Adjust **brush size** (1–3 pixels) in the flyout panel that appears next to the draw/line tools
4. Adjust **eraser size** in the flyout panel that appears next to the erase tool

## Settings

| Setting | Scope | Description |
|---|---|---|
| Pixel Size | World | Size of each paint pixel in scene units (1–100, default 5). Lower = higher resolution. |
| Paint Opacity | World | Opacity of the paint layer (0.1–1.0, default 0.7) |
| Brush Color | Client | Currently selected brush colour |
| Brush Size | Client | Currently selected brush size (1–3 pixels) |
| Eraser Size | Client | Currently selected eraser size |

## Compatibility

- Foundry VTT **v13** (Build 351+)
- No dependencies
