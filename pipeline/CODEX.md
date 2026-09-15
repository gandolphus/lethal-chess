# CODEX · pipeline

**Purpose:** Offline data pipeline. Turns public chess data (Lichess eval db, opening catalog) into the
static bundles the app ships. Runs natively under Node 24 (TypeScript via type stripping), never in the
browser.
**Owned by:** lethal-chess
**Exposes:** CLI entry points (see package.json `pipeline:*` scripts); build artefacts under `data/` (gitignored).
**Depends on:** chess.js, `zstd` on PATH, `node:crypto`, `node:fs`.

## Contents
| Name | Purpose |
|------|---------|
| lib/codec.ts | uint16 move / int16 score encodings, `toEpd`. |
| lib/uci.ts | `normalizeCastling` — the eval db writes castling king-takes-rook; chess.js needs `e1g1`. Call on every cache move. |
| eval-cache/format.ts | On-disk record layout + types. |
| eval-cache/build.ts | Streams the eval db once → sorted 64-byte records + prefix index. |
| eval-cache/reader.ts | `EvalCache.get(epd)`. |
| **/*.test.ts | vitest (`pnpm test`). |

## Conventions
- Imports use explicit `.ts` extensions (Node type stripping requires it); erasable TS syntax only — no enums, no parameter properties.
- Build artefacts are temporary and live in `data/`; delete once shipped bundles are built.
- Scores are always White's point of view, as in the source.
