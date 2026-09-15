---
tags: [feature, done]
aliases: [Play vs Computer, MVP]
---

# Play vs Computer

**Status: done (MVP), 2026-09-15.** The substrate for [[Opening Drills]], not the product.
See [[System Map]] for where the pieces live.

## What it does

- Full legal chess against [[Stockfish]] — castling, en passant, promotion, check/mate/stalemate/draw,
  all via [[chess.js]].
- Board interaction: click-to-move *and* pointer drag. Dropping a dragged piece back on its origin
  square degrades into a selection, so a drag that changes its mind does not lose state.
- Legal-target dots (rings on captures), last-move and check highlights, file/rank coordinates.
- Promotion picker overlay.
- Five difficulties (`Beginner 1320` → `Max`), side selection, undo, SAN move list.
- Undo steps back **two** plies so it lands on the player again.

## Verified

Not assumed — checked on 2026-09-15:

- `pnpm check` clean (0 errors).
- Engine answers UCI and honours `UCI_Elo` — driven through stockfish's node harness.
- **Browser Worker path proven end-to-end**: headless Firefox against a logging server showed the
  worker fetch `stockfish-18-lite-single.wasm`, emit `uciok`/`readyok`, and return
  `bestmove e7e5` to `e2e4`. This was worth doing separately — the node harness uses
  `sendCommand`, the browser uses `postMessage`, and only the latter is what the app runs.
- Board render confirmed by screenshot.

## Audit fixes (2026-09-15, Fable 5.1 code audit)

An adversarial audit found real bugs; fixed and re-verified the same day. See [[Decision Log]].

- **Stale engine move applied to a new game** (high). Starting a new game while the engine was
  thinking let the old search's `bestmove` land on the fresh board — legally, e.g. `Nf3` from the
  start position. Root cause: the worker executes `position` immediately but queues `go`, and the
  page had no notion of a superseded search. Fix: `Engine` serialises every state-touching command
  behind a lock, `newGame()` sends `stop`, results are tagged with their FEN, and the page carries
  a generation token.
- **Undo as Black at move 1 froze the game** (med) — the engine was never asked to move again.
- **Stale legal-move dots after undo/new game** (low) — selection now clears on any FEN change.
- **Opponent pieces could be picked up** (low); any mouse button started a drag.
- **Engine load failure was silent** (low) — now surfaces in the status line.
- `configure()` resolved before its options applied; `destroy()` left pending searches hanging.

**Verified:** mock worker reproducing Stockfish's real queue semantics (8/8 checks, including
"no `position` mid-search"), then the same scenario against the real WASM worker in headless
Firefox — `stop` cut a 4 s search to ~485 ms end to end, both results correctly FEN-tagged.

## Known limitations

Carried into [[System Map]] § Known gaps:

- Nothing persists across reload.
- Pieces are Unicode glyphs (filled set, recoloured via CSS) — placeholder for SVG.
- No move animation between squares; needs stable piece identity, not square-keyed rendering.
- `role="application"` with no keyboard support.
- No draw-offer / resign / clock. Not needed for drilling.

## Why it exists

A drill has to end somewhere — "now play it out" is the *Apply* rung of any training loop. Having a
working opponent first means [[Opening Drills]] can assume it rather than stub it.
