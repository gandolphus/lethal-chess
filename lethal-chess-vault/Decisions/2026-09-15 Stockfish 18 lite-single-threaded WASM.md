---
status: accepted
date: 2026-09-15
tags: []
---
# Stockfish 18 *lite/single-threaded* WASM

Using the lite single-threaded build (7 MB) rather than the full one (113 MB) or the
multi-threaded one. Multi-threaded needs `SharedArrayBuffer`, which needs COOP/COEP cross-origin
isolation headers — a deployment constraint we do not want to inherit for an opponent that only has
to play at club strength. `scripts/sync-engine.js` copies it into `static/engine/` (gitignored);
pnpm's `allowBuilds: stockfish: false` in `pnpm-workspace.yaml` suppresses the package's own
postinstall, which only symlinks the 113 MB build we are not using.

Difficulty maps to `UCI_LimitStrength` + `UCI_Elo`. **Stockfish refuses Elo below 1320**, so
"Beginner" is 1320 — a genuine floor, not a chosen one. Going weaker needs `Skill Level` or
deliberate move corruption.
