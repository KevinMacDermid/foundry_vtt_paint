# Agent Rules

## General Notes for Future Sessions

### On every session start, run this:
```bash
ln -sf /home/pi/workspace/.ssh /root/.ssh
```
This restores the SSH symlink lost on container restart. Without it, `git push` will fail.

---

- **Each `Bash` tool call is a fresh shell** — environment variables do NOT persist between calls. Keep this in mind when chaining dependent commands.
- **SSH for GitHub just works** as long as `/root/.ssh` is symlinked to `/home/pi/workspace/.ssh`. Run `ln -sf /home/pi/workspace/.ssh /root/.ssh` if git push fails with a host key error (the symlink is lost on container restart). The `.profile.d/ssh.sh` script does this automatically if sourced.
- **Docker container restarts wipe system state** — any `apt-get` installs, global npm packages, or other system-level changes from a previous session are gone. Reinstall as needed. Workspace files (code, keys, etc.) persist.
- **Playwright deps may be missing after restart** — run `npx playwright install-deps chromium` if the smoke test fails to launch a browser.
- **When you discover a new environmental quirk or workaround, add it here** so future sessions don't have to rediscover it.

## Commit & Push

- **Commit whenever something is working.**

## TODO: Improve Release Process

Currently, installation requires the awkward raw GitHub URL:
`https://raw.githubusercontent.com/KevinMacDermid/foundry_vtt_paint/main/module.json`

Other modules (e.g. roth-michael/Aura-Effects) use GitHub Releases with `module.json`
and `module.zip` uploaded as release assets. The install URL then becomes:
`https://github.com/KevinMacDermid/foundry_vtt_paint/releases/download/vX.Y/module.json`

To fix this, add a GitHub Actions workflow (`.github/workflows/release.yml`) that:
1. Triggers on version tag push (e.g. `v0.3`)
2. Builds a `module.zip` of the repo contents
3. Creates a GitHub Release with `module.json` and `module.zip` as assets
4. Updates `manifest` and `download` fields in `module.json` to point to the release assets

No `gh` CLI available in the container — can be done via GitHub Actions OR manually:
1. `zip -r module.zip . --exclude ".git/*"` to build the zip
2. Upload zip + module.json to a GitHub release via web UI or GitHub REST API with curl
3. Update manifest/download fields in module.json to point to release asset URLs before tagging

Hold off on this until the module feels ready to share with the community. After any feature, fix, or meaningful change is verified (smoke test passes or manually confirmed), commit immediately with a clear message. Don't batch unrelated changes.
- **Source SSH before pushing**: `source /home/pi/workspace/.profile.d/ssh.sh` — must be run each session or `git push` will fail with host key verification errors.
- **Run the smoke test before committing.** `node test/smoke.mjs` — server must be running and Gamemaster must not be logged in. If the test fails at sign-in, it may be because a human user is already logged in as Gamemaster at the same time; ask them to log out and retry.
- **Git identity** is pre-configured (`Foundry Paint Dev / dev@foundry-paint.local`).
