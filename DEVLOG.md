# Foundry Paint — Development Log

## What We're Building

A painting/drawing tool module for Foundry VTT (v13). The module adds painting capabilities to the virtual tabletop.

## Development Plan

### Phase 1: Get a working module doing anything ✅
- [x] Scaffold module structure (`module.json`, `scripts/main.mjs`, `styles/module.css`)
- [x] Symlink into Foundry data modules directory
- [x] Confirm module loads and is active in the test world
- [x] Basic proof-of-life: floating "Paint" button that shows a notification on click
- [x] Console log confirms module initialization

### Phase 2: Bitmap paint with draw/erase ✅
- [x] Low-res bitmap grid overlay (configurable pixel size, default 20 scene units)
- [x] PIXI Sprite with nearest-neighbor scaling for chunky pixel look
- [x] Draw tool (paints with configurable color)
- [x] Erase tool (clears pixels)
- [x] Clear All button (with confirmation dialog)
- [x] Scene controls integration (palette icon group)
- [x] HTML overlay to block canvas panning while painting
- [x] Screen→scene coordinate transform for accurate painting
- [x] Persistence: saves/loads paint data per-scene via flags (PNG data URL)
- [x] Settings: pixel size, brush color, opacity

### Phase 3: TBD
- [ ] ...

## Technical Setup

- **Module directory**: `/home/pi/workspace/foundry_paint`
- **Symlinked to**: `/home/pi/workspace/foundry-data/Data/modules/foundry-paint`
- **Foundry version**: v13 (Build 351)
- **Test world**: `test1` (text-based actors system)
- **Server**: Run in tmux session `foundry` on `http://localhost:30000`
- **Admin password**: `test123`

## Current State

Phase 2 complete. Bitmap painting works — draw and erase with chunky pixels on the Foundry canvas. Paint data persists per-scene. Controls are in the left sidebar under a palette icon.
