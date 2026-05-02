# Agent Rules

- **Commit whenever something is working.** After any feature, fix, or meaningful change is verified (smoke test passes or manually confirmed), commit immediately with a clear message. Don't batch unrelated changes.
- **Run the smoke test before committing.** `node test/smoke.mjs` — server must be running and Gamemaster must not be logged in.
- **Git identity** is pre-configured (`Foundry Paint Dev / dev@foundry-paint.local`).
