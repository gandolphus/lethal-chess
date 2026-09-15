---
tags: [feature, planned, data]
aliases: [Opening Classification, Opening Weaknesses]
---

# Opening Classification

**Status: designed, catalog imported, classification not built.** Goal 1 from 2026-09-15.

> "Have all popular (and not so popular) openings classified according to relative strength. The
> King's Gambit (for White) should have a list of weaknesses — and I want to drill those."

Design source: [[2026-09-15 — Fable design review]]. Data: [[Data sources]].

## Done

- **Catalog imported.** `scripts/build-catalog.js` (`pnpm catalog:build`) → `static/openings/catalog.json`:
  3,810 named lines from `lichess-org/chess-openings` (CC0), each with ECO, name, PGN, UCI moves and
  terminal position (EPD). Every line is replayed through [[chess.js]]; the build fails loudly on any
  line that doesn't. 0 failures, 0 shared terminal positions. 968 KB.

## Design — first rollout is objective only

Per [[Decision Log]] 2026-09-15 ("precision first"), everything rating-based is deferred.

**Strength (first rollout):**

- **Objective cost** — how much the engine thinks choosing this opening gives up, versus the best
  alternative at the same moment. From the Lichess eval db. KG ≈ 0.7 pawns.
- **Precision burden** — how narrow the path is for the side that chose it: how often it faces
  positions with only one or two moves within tolerance. An opening can be objectively fine and still
  demand perfect play; that is a real cost for the person playing it.

**Weakness (first rollout)** = a position + the punishing move + the engine line, detected
objectively:

1. **Refutation** — an opponent move that swings the eval against the opening, where the defending
   side then has only-moves to survive.
2. **Trap** — a *natural-looking* move for the opening side that loses. Without human data, "natural"
   is approximated by moves the engine likes at low depth but refutes at high depth (measurable with
   native Stockfish).

**Deferred ("maybe"):** *practical edge* — how an opening scores at a given rating band — and the
trap value it implies. That was the original lethality idea
([[Lineage — from lethality analyzer to drilling tool]]); it needs the game dump and comes back only
if rating-based strategy does.

**Explanations:** engine line first (always true), then computed board facts ("f2 pawn gone, e1–h4
diagonal open"), then hand-written notes for openings you actually play. An LLM may only rephrase
verified facts, never originate chess content.

**Drill:** exploit side first — you're facing the King's Gambit, find the punishment.

## Pipeline (offline, native — not in the browser)

1. Stream the eval db once → temporary opening-phase eval cache ([[Data sources]]).
2. For every catalog line: objective cost at its choice point, precision burden along it.
3. Weakness detector; native [[Stockfish]] fills eval gaps and supplies the low-depth "natural move"
   signal for traps.
4. Per-opening JSON bundles, lazily loaded. Cache deleted.

Shares steps 1 and 3 with [[Opening Drills]]' tree builder. **Ordering:** drills first (user:
"get super proficient first"), classification second, on the same data.

## Resolved

- **EPD join convention — checked, compatible.** Both the eval db and chess.js write an en passant
  square only when a capture is actually legal (eval db sample: 1,297 of 1,297; chess.js tested).
