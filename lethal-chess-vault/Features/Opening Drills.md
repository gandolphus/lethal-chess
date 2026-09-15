---
tags: [feature, planned]
aliases: [Opening Drills, The Drill Loop, Repertoire Drills]
---

# Opening Drills

**Status: designed (precision-first revision), foundation not built.** The core of the first rollout.

> "I play English as White and Sicilian as Black. Sometimes Caro-Kann. I want to get super proficient
> first and foremost." — and for the English: "all aspects, but most importantly the aggressive ones,
> and the ones which require the most precision from the opponent."

Decisions: [[Decision Log]] 2026-09-15. Tracking: [[Progress Tracking]]. Sister feature sharing the
same data: [[Opening Classification]]. Look and feel: [[Visual Design]].

## Repertoires

| Repertoire | Side | Root |
|---|---|---|
| English | White | `1.c4` |
| Sicilian | Black | `1.e4 c5` |
| Caro-Kann | Black | `1.e4 c6` |

## Tracks

Every named catalog line under a repertoire is a **track** — the unit you choose to study and the
unit proficiency is measured on. Names give the hierarchy for free:
`Sicilian Defense` → `Najdorf Variation` → `English Attack`. No upfront "which Sicilian?" decision.

## How a track's tree is built (offline)

Precision-first — objective engine truth, no rating assumptions.

- **Your moves:** the catalog move along the track, then the engine's best move once the named line
  ends. A sound alternative can be adopted as your move instead.
- **Opponent moves:** every reply within tolerance of best (from the eval db's candidate lines) **plus**
  every catalog-named reply. The catalog includes the dubious-but-real lines people play; you need to
  know how to punish those too.
- **Depth:** to a ply budget per track (~16–20 plies), expanded in order of importance.
- **Priority — sharpness:** at each opponent-to-move position, how few moves stay within tolerance and
  how far the second-best falls. High sharpness = the opponent must be precise = the lines the user
  wants first. "Aggressive" is approximated by this plus hand tags; it is not directly measurable.

## The drill

- **Card** = (repertoire, position where it is your move), keyed by EPD so transpositions share a card.
- **Session** = walk a track from its start; the opponent plays replies weighted toward sharp and
  under-practised branches; every card on the way is graded.
- **Grading, by eval:**
  - your repertoire move → **pass**
  - a different move within tolerance → **soft** ("sound, but not your line"), shown, not failed
  - anything else → **fail**, with centipawn cost and the refuting engine line
- **On fail:** flash → one unhinted retry → reveal *and make you play it* → continue the line → the
  card comes back at the end of the session.
- **Scheduling:** FSRS per card, derived from the append-only attempt log.
- **"Known":** ≥ 3 consecutive passes at ≥ 21-day intervals, fast, including at least one from a random
  mid-track start with the opening name hidden.
- **Apply rung:** after the track's last position, optionally play it out against the engine.

## Code prerequisites ([[2026-09-15 — Fable code audit]])

- `Game.load(fen)`; `move()` returns the move instead of a boolean; non-mutating legality check.
- Board takes generic `marks` + `arrows` instead of bespoke `lastMove`/`checkSquare` props.
- Play loop lifted out of `+page.svelte` into a controller; the drill controller is its sibling.

## Deferred

Rating-band frequencies and "what players at your level get wrong" — bottom of the backlog by user
direction.
