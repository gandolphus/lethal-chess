# CODEX · lethal-chess

**Purpose:** A chess drilling tool (openings first). Currently an MVP that plays full legal chess
against a Stockfish WASM opponent; the drilling layer is next.
**Owned by:** (project root)
**Exposes:** SvelteKit app at `/` — the play-vs-computer screen.
**Depends on:** chess.js (rules), stockfish (engine, GPL-3.0), SvelteKit/Svelte 5/Vite.

## Contents
| Name | Purpose |
|------|---------|
| src/lib/chess/ | Framework-agnostic core: `engine.ts` (UCI/Worker), `game.svelte.ts` (reactive chess.js wrapper), `pieces.ts`. Imports nothing from Svelte — on purpose. |
| src/lib/components/ | `Board.svelte` — hand-rolled 8×8 board, click + drag, highlights, promotion. |
| src/routes/ | `+page.svelte` holds the game loop (this is where the drill layer will plug in). |
| scripts/sync-engine.js | Copies the Stockfish lite/single WASM build into `static/engine/` (generated, gitignored). |
| static/ | Static assets. `engine/` is generated. |
| lethal-chess-vault/ | Obsidian planning vault (Catppuccin) — vision, System Map, Decision Log. Source of truth for *why*. |
| README.md | Setup + overview. |

## Conventions
- Core logic stays framework-agnostic (`src/lib/chess/*`); components wrap it. Future WebGL layers
  follow the same rule — plain TS with a `mount(canvas)` API.
- pnpm settings live in `pnpm-workspace.yaml`, not `package.json` (pnpm 11).
- Update the vault the same day code or decisions change.
