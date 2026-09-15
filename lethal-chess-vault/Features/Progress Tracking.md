---
tags: [feature, planned]
aliases: [Progress Tracking, Proficiency]
---

# Progress Tracking

**Status: designed, not built.** First-class requirement, not a by-product of drilling.

> "We do need reliable tracking and progress measuring for the various openings. You should easily be
> able to see how proficient you are using the various openings."

Feeds from [[Opening Drills]]. Storage decision in [[Decision Log]] 2026-09-15 (SQLite on disk).

## Principle: log facts, derive everything

The only thing written during a drill is an **append-only attempt log**: card, timestamp, move played,
expected move, grade (pass / soft / fail), centipawn cost, response time, whether a hint was used.

Everything else is *derived* and can be recomputed at any time:

- FSRS scheduling state per card.
- Proficiency per **track**, rolled up per **family** and **repertoire**
  (English → Symmetrical → …; Sicilian → Najdorf → English Attack).

So if the proficiency formula or the scheduler turns out to be wrong, history is not lost.

## What proficiency should show (proposal)

Per track / family / repertoire:

- **Coverage** — share of the tree's cards you have ever passed.
- **Retention** — share of cards currently "known" (FSRS stability above threshold).
- **Precision** — pass rate over the last N attempts; soft results counted separately.
- **Speed** — median response time on passes.
- **Weakest positions** — the cards failing most, one click into a drill of exactly those.
- **Trend** — over time, so progress is *visible*.

Exact formula to be settled when there is real data to look at, which the append-only log makes safe
to postpone.

## Planned: line mastery (user idea, 2026-09-15 — not built yet)

> "A sort of SRS approach to the drilling — and that could be a way to estimate someone's proficiency
> too: the number of lines which have been sufficiently repeated and remembered."

**What already exists:** spaced repetition per *position* — every learner decision is an FSRS card, so
missed positions return sooner and known ones later; *Retention* is computed from those schedules.

**What this adds:** the same idea at the level of *lines*, which is how players think about openings.

- **A line** = a path from the repertoire root to a line end in the bundle tree (a leaf, or where the
  drill says "Line complete"). Transpositions mean lines can share positions; that's fine.
- **A line is mastered** when *every* learner decision along it is currently remembered: recall
  ≥ 0.9 **and** FSRS stability above a threshold (e.g. ≥ 21 days, so a line crammed today doesn't count).
  Echoes the "known" definition in [[Opening Drills]] (≥ 3 passes at ≥ 21-day intervals).
- **Headline proficiency:** "14 of 31 lines mastered" per opening, plus a family roll-up — more intuitive
  than position percentages, and harder to game.
- **Scheduling at line level:** "Next line" prefers lines that are *almost* mastered (one weak position)
  and lines with due positions, so a session closes out whole lines instead of scattering.
- **Weighting question (open):** a sideline that occurs 3% of the time shouldn't count like the main
  line. Option: report both a raw count and a *reply-weighted* mastery (sum of line probabilities from the
  bundle's reply weights), i.e. "you're ready for 82% of what opponents play here".

All of this is derivable from the existing append-only attempt log and card states — no new data needed.

## Storage

`node:sqlite` (Node 24 built-in, verified). One database file outside the repo so it survives
reinstalls and is easy to back up. Location TBD.
