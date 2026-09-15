---
tags: [moc, system-map]
aliases: [Architecture, System Map]
---

# System Map · lethal-chess

Source of truth for **what exists and why**. See [[Decision Log]] for rationale, [[Home]] for vision.

## Stack

| Layer | Choice | Note |
|---|---|---|
| Framework | [[SvelteKit]] + Svelte 5 (runes) | Runes forced on in `vite.config.ts` |
| Language | TypeScript | |
| Build | Vite 8 | |
| Rules engine | [[chess.js]] | Legal moves, SAN/FEN, mate/draw detection |
| Chess engine | [[Stockfish]] 18 lite/single WASM | Web Worker, UCI |
| Package manager | pnpm 11 | Settings live in `pnpm-workspace.yaml`, not `package.json` |
| Styling | Plain scoped CSS, Catppuccin Mocha | Palette in `src/app.css` |
| Persistence | **none yet** | Everything is in-memory; a reload loses the game |
| Backend | **none yet** | SvelteKit's server layer is unused so far |

## Directory layout

```
src/
  app.css                     Catppuccin Mocha tokens, global reset
  lib/
    chess/
      engine.ts               Stockfish worker wrapper (UCI). Framework-agnostic.
      game.svelte.ts          Reactive chess.js wrapper (runes)
      pieces.ts               Glyph table
    components/
      Board.svelte            Hand-rolled 8x8 board: click + drag, highlights, promotion
  routes/
    +layout.svelte            Imports app.css
    +page.svelte              Play-vs-computer screen (game loop lives here)
scripts/
  sync-engine.js              Copies the WASM build out of node_modules into static/engine
  build-catalog.js            Fetches + validates the Lichess opening catalog (pnpm catalog:build)
static/
  engine/                     GENERATED, gitignored — see sync-engine.js
  openings/catalog.json       GENERATED, committed — 3,810 lines, EPD-indexed (see [[Opening Classification]])
lethal-chess-vault/           This vault
```

## Data flow

```
user pointer → Board.svelte → onMove(from,to,promo)
                                  ↓
                            Game (chess.js)  ──validates, mutates, republishes runes──┐
                                  ↓                                                   │
                            +page.svelte sees turn flipped                            │
                                  ↓                                                   │
                            Engine.bestMove(fen, movetime)                            │
                                  ↓                                                   │
                            Worker ⇄ stockfish WASM (UCI over postMessage)            │
                                  ↓                                                   │
                            uci string "e7e5" → Game.move() ──────────────────────────┘
```

**The layering is the point.** `engine.ts`, `game.svelte.ts` and `pieces.ts` know nothing about
Svelte components; `Board.svelte` knows nothing about the engine. The drill layer
([[Opening Drills]]) plugs in at the same level `+page.svelte` does — it swaps the *policy*
(which position, what's the expected reply, what happens on a wrong move) without touching the
board or the engine. See [[Decision Log]] 2026-09-15 on keeping the render layer agnostic too.

## Data model

Deliberately thin for now — there are no persisted entities yet.

- `Game` — wraps a single `Chess` instance. Publishes `fen`, `turn`, `history`, `lastMove`,
  `checkSquare`, `status`.
- `Difficulty` — `{ id, label, elo, moveTimeMs }`. Maps to UCI `UCI_LimitStrength` + `UCI_Elo`.
  Stockfish's floor is Elo 1320; that is the engine's limit, not a design choice.

Everything the drilling product needs — repertoire, scheduling state, mistake history — is
**not designed yet**. See [[Opening Drills]].

## Known gaps

- No persistence, no routing beyond `/`.
- Pieces are Unicode glyphs, not SVG.
- Board has `role="application"` and no keyboard support.
- Pieces re-render in place; moves do not animate between squares (would need stable piece IDs).
- Engine strength below ~1320 Elo is not reachable via `UCI_Elo`; would need `Skill Level` or
  deliberate move corruption.
