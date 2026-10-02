---
status: accepted
date: 2026-09-15
tags: []
---
# Engine commands are serialised; results carry their FEN

A Fable 5.1 audit found that a new game started mid-search could receive the *old* search's move
(details in [[Play vs Computer]]). The underlying fact: the Stockfish worker queues `go`/`setoption`
behind a running search but runs `position`/`isready`/`ucinewgame` immediately, so any caller that
interleaves commands silently corrupts state.

Decision: `Engine` owns that problem, not its callers. Every state-touching operation goes through
one serial lock; `bestMove()` returns `{ fen, move }` so a caller can always check the result still
applies. Callers additionally keep a generation token. This matters more for [[Opening Drills]]
than for play — drills jump positions constantly, so the bug would have been routine, not rare.
