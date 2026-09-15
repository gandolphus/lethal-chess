---
tags: [feature, built]
aliases: [Coached Free Play, Keep playing, Free play]
---

# Coached Free Play

**Status: built (logic tested, wired into the drill page), 2026-09-15.** Awaiting hands-on testing.

> "In learn mode I would like to be able to keep playing when the line has reached its end. The computer
> should keep informing me whether it's a good or bad move, and respond in natural ways — not necessarily
> the best moves, but still good moves. Sometimes sprinkle in mistakes by the computer and see whether
> the user catches it. If not, inform them they missed an opportunity and tell them to try again."

Runs on the in-browser engine — the reason for [[Decision Log]] "Open source under AGPL-3.0".
Related: [[Opening Drills]] (where it starts), [[Off-book Practice]] (the same instinct inside the book).

## How it works — `src/lib/coach/`

- **Entry:** when a Learn-mode line ends, *Keep playing* hands the position to `FreePlay`. The 7 MB
  engine downloads only then.
- **Verdicts (`judge.ts`):** drop in *winning chances* — Lichess's logistic model and thresholds
  (inaccuracy ≥ 0.1, mistake ≥ 0.2, blunder ≥ 0.3). Chosen over raw centipawns because losing 1.5 pawns
  at +8 changes nothing, at 0.00 it decides the game.
- **Natural replies (`opponent.ts`):** any candidate within 0.06 winning chances of best, weighted
  toward the best — varied like a human, never bad.
- **Planted mistakes:** with probability 15% (when one exists), a candidate losing 0.15–0.5 — a real
  error, not an absurd one. It only counts as an *opportunity* if it actually hands the learner ≥ 0.15.
- **Missed opportunity:** if the learner's reply is not sound, the move is taken back — "You missed an
  opportunity: …f6 can be punished. Try again." A second miss reveals the punishing move with an arrow
  and requires playing it.
- **Engine use per turn:** one multi-PV analysis after the learner's move (grades it *and* supplies the
  computer's candidates) and one for the learner's next position.

## Verified

- 28 unit tests (verdicts, symmetry, natural vs planted choice, the full miss → retry → reveal flow,
  empty-analysis resilience, the multi-PV collector).
- **Against the real Stockfish WASM in Chromium:** after 1.e4 e5 2.Nf3 f6? the engine's best is
  Nxe5 (+1.53) — the punishment the coach should expect; scores convert correctly for both sides.
  This check found the mid-depth duplicate-PV bug, since fixed.

## Open

- Thresholds are Lichess's defaults and the 15% mistake rate is a guess; tune with real sessions.
- Practice mode does not continue past the line — by design for now.
- Explanations are verdict + better move only; no prose (per the no-LLM-chess-content rule).
