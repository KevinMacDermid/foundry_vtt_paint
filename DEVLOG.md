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

### Phase 2: Start to make it do what we want
- [ ] Define what the painting tool should actually do (TBD — needs discussion)
- [ ] ...

## Technical Setup

- **Module directory**: `/home/pi/workspace/foundry_paint`
- **Symlinked to**: `/home/pi/workspace/foundry-data/Data/modules/foundry-paint`
- **Foundry version**: v13 (Build 351)
- **Test world**: `test1` (text-based actors system)
- **Server**: Run in tmux session `foundry` on `http://localhost:30000`
- **Admin password**: `test123`

## Current State

Phase 1 complete. The module loads, shows a purple "Paint" button in the top-right corner of the game UI, and displays a notification when clicked. Ready to start building real functionality.
