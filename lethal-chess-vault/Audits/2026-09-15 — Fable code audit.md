---
tags: [audit, code, fable]
aliases: [Fable code audit]
---

# 2026-09-15 — Fable 5.1 code audit

Correctness audit of the [[Play vs Computer]] MVP. All findings fixed the same day and verified
against the real engine — see [[Play vs Computer]] § Audit fixes and [[Decision Log]].

| # | Sev | Finding | Status |
|---|---|---|---|
| 1 | high | New game mid-search → old search's `bestmove` applied to the new board (legally) | fixed: serial lock, `stop`, FEN-tagged results, generation token |
| 2 | med | Undo as Black at move 1 → engine never asked to move, game frozen | fixed |
| 3 | med | `position` sent into a running search; `destroy()` left promises hanging | fixed |
| 4 | low | `configure()` resolved before `setoption` applied | fixed (lock) |
| 5 | low | Legal-move dots stale after undo / new game | fixed: clear selection on FEN change |
| 6 | low | Opponent pieces draggable; any mouse button dragged | fixed |
| 7 | low | Engine load failure silent | fixed: surfaces in status |

**Verified fine by the audit:** always passing `promotion: 'q'` (chess.js 1.4 ignores it on
non-promotions — tested), waiter-queue pairing, promotion/underpromotion, play as Black,
mate/stalemate/threefold/50-move detection.

## Fit for the drilling phase — its recommendations (not yet done)

1. `Game` needs `load(fen)`, a `move()` that returns the Move rather than a boolean, and a
   non-mutating legality check so wrong answers can be judged without flicker.
2. `Engine` needed cancellation + position tagging — **done** as part of fix #1.
3. `Board` should take generic `marks` (square → class) and `arrows` instead of bespoke
   `lastMove`/`checkSquare` props.
4. Move the play loop out of `+page.svelte` into a controller, so a drill controller is a sibling
   rather than a fork of the page.
