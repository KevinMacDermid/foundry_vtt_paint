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

- **Commit whenever something is working.** After any feature, fix, or meaningful change is verified (smoke test passes or manually confirmed), commit immediately with a clear message. Don't batch unrelated changes.
- **Source SSH before pushing**: `source /home/pi/workspace/.profile.d/ssh.sh` — must be run each session or `git push` will fail with host key verification errors.
- **Run the smoke test before committing.** `node test/smoke.mjs` — server must be running and Gamemaster must not be logged in. If the test fails at sign-in, it may be because a human user is already logged in as Gamemaster at the same time; ask them to log out and retry.
- **Git identity** is pre-configured (`Foundry Paint Dev / dev@foundry-paint.local`).
