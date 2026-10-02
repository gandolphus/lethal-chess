---
status: accepted
date: 2026-09-15
tags: []
---
# Hand-rolled board, not a library

`Board.svelte` is ~250 lines of our own: 8×8 grid, click-to-move + pointer drag, legal-target dots,
last-move and check highlights, promotion picker. Rejected `react-chessboard` (wrong framework once
SvelteKit was chosen) and chessground (Lichess's own, framework-agnostic, genuinely good).

Reason: the drill UI is going to need overlays chessground doesn't model — correct/wrong flashes,
masked squares, hint arrows tied to drill state. Owning the board means those are props, not
fights with a library. **Revisit if** premoves or serious animation become priorities; chessground
has years of polish there that we do not.
