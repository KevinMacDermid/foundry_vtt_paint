# Foundry Paint

A painting/drawing tool module for Foundry VTT v13.

## Project Status

See `DEVLOG.md` for full progress tracking.

- **Phase 1** ✅ — Working module scaffold with proof-of-life UI
- **Phase 2** 🔲 — Build actual painting functionality (TBD)

## Project Structure

```
foundry_paint/
├── module.json          # Foundry VTT module manifest
├── scripts/main.mjs     # Module entry point
├── styles/module.css     # Module styles
├── test/smoke.mjs        # Playwright smoke test
├── DEVLOG.md             # Development log
└── AGENTS.md             # This file
```

## Development Setup

- **Foundry server**: Run in tmux — `tmux new-session -d -s foundry 'cd /home/pi/workspace/foundry-vtt-server && node main.mjs --dataPath=/home/pi/workspace/foundry-data --port=30000 --headless'`
- **Module symlink**: `/home/pi/workspace/foundry-data/Data/modules/foundry-paint -> /home/pi/workspace/foundry_paint`
- **Test world**: `test1` on `http://localhost:30000`
- **Admin password**: `test123`
- **Smoke test**: `node test/smoke.mjs` (server must be running, Gamemaster must not be logged in)

## Key Decisions

- Using ESM (`esmodules` in manifest)
- Targeting Foundry VTT v13 (Build 351)
- Use the foundry-vtt-module skill at `.pi/skills/foundry-vtt-module/SKILL.md`
