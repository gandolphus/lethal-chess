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

## Storage

`node:sqlite` (Node 24 built-in, verified). One database file outside the repo so it survives
reinstalls and is easy to back up. Location TBD.
