# lethal-chess

A tool for drilling chess, starting with openings. Not a course, not an analysis board — a training
loop: meet a position, play the move, find out immediately, see it again when it matters.

**Current state:** MVP. You can play full legal chess against Stockfish. The drilling layer — the
actual product — is designed but not built; see `lethal-chess-vault/Features/Opening Drills.md`.

## Stack

SvelteKit (Svelte 5 runes) · TypeScript · Vite · chess.js · Stockfish 18 WASM in a Web Worker.

## Setup

```bash
pnpm install     # also copies the Stockfish build into static/engine/
pnpm dev
```

Then open http://localhost:5173.

`static/engine/` is generated and gitignored — `scripts/sync-engine.js` copies the 7 MB
lite/single-threaded Stockfish build out of `node_modules`. Re-run it alone with `pnpm engine:sync`.

## Commands

| | |
|---|---|
| `pnpm dev` | dev server |
| `pnpm build` / `pnpm preview` | production build |
| `pnpm check` | svelte-check (types + a11y) |
| `pnpm engine:sync` | re-copy the Stockfish WASM build |

## Licence note

Stockfish is **GPL-3.0** and shipping WASM to a browser counts as distribution. Fine for a personal
tool; must be settled before anything commercial. See
`lethal-chess-vault/Concepts/Engine licensing.md`.

## Planning vault

`lethal-chess-vault/` is an Obsidian vault (Catppuccin Mocha) holding the project's vision,
architecture map, decision log and per-feature notes. It is the source of truth for *why* things are
built the way they are — start at `Home.md`, then `System Map.md`.
