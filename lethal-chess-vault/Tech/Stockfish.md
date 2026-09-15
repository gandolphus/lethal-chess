---
tags: [tech]
aliases: [Stockfish]
---

# Stockfish

`stockfish@18.0.8` npm. The opponent in [[Play vs Computer]]. Wrapped by
`src/lib/chess/engine.ts`, which is framework-agnostic on purpose ([[Decision Log]] 2026-09-15).

## Which build

Using **`stockfish-18-lite-single`** — lite, single-threaded, ~7 MB WASM.

| Build | Size | Why not |
|---|---|---|
| full | 113 MB | absurd for a web app |
| lite (multi-threaded) | 7 MB | needs `SharedArrayBuffer` → COOP/COEP cross-origin isolation headers |
| **lite-single** | **7 MB** | **chosen — no header requirements** |
| asm | 10 MB JS | fallback for no-WASM, not needed |

## Gotchas

- **The package's `postinstall` only symlinks the 113 MB full build.** We do not want it.
  `pnpm-workspace.yaml` has `allowBuilds: { stockfish: false }`; without it pnpm 11 *hard-fails*
  the install with `ERR_PNPM_IGNORED_BUILDS`. `scripts/sync-engine.js` does the copy we actually want.
- **Two different APIs depending on environment.** In a browser Worker it is `postMessage` +
  `onmessage`. Under node via `stockfish/index.js` it is `engine.sendCommand(cmd)` +
  `engine.listener = fn`. Testing one does *not* test the other — both were checked separately
  on 2026-09-15.
- **`UCI_Elo` has a floor of 1320.** Below that, `UCI_LimitStrength` does nothing. Weaker play needs
  `Skill Level` (0–20) or corrupting the chosen move deliberately.
- The `.js` locates its `.wasm` relative to its own URL, which is why both files are copied into
  `static/engine/` together and served from the same path.

## Licence

**GPL-3.0.** See [[Engine licensing]] — unresolved, deliberately.
