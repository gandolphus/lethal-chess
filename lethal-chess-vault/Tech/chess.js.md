---
tags: [tech]
aliases: [chess.js]
---

# chess.js

`chess.js@1.4.0`. All rules logic. Wrapped by `src/lib/chess/game.svelte.ts`.

## Why wrapped

The `Chess` instance is **mutable and not reactive** — mutating it does not notify Svelte. So every
mutation funnels through a private `#sync()` that republishes derived state (`fen`, `turn`,
`history`, `checkSquare`, `status`) as runes. Nothing outside `Game` touches the instance.

## Gotchas

- **`move()` throws on an illegal move** in 1.x — it does not return `null`. `Game.move()` catches
  and returns `false`.
- `moves({ square, verbose: true })` is how legal targets *and* promotion detection are derived;
  a move is a promotion iff the verbose entry has a `promotion` field.
- `history()` returns SAN strings; `board()` returns an 8×8 array used to locate the king for the
  check highlight.

Related: [[Stockfish]] (UCI long-algebraic `e7e8q` ↔ chess.js `{from,to,promotion}`) · [[System Map]]
