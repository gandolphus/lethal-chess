---
status: accepted
date: 2026-09-15
tags: []
---
# Exploration replaces Learn

The user rejected arrow-led Learn in favour of active learning: established lines are secret and the
learner discovers them. The design and definitions are in [[Exploration Mode]]. Key choices:
- **Line.** A catalog leaf under the defining moves.
- **Stages.** *Entered* at the deepest named position before the end, *discovered* at the end.
- **Dubious lines** (a learner move losing ≥ 0.2 win chance) are counted separately.
- **Try again / Play on** only for mistakes off the book.
- **Book replies** steered toward undiscovered lines and discounted when unsound.
- **Hints.** A line found through an arrow hint doesn't count.
- **Storage.** D1 `discoveries` table (migration 0002). Local D1 had no migration history, so 0002 was
  applied with `d1 execute`. Check the remote history before deploying.

Bundles grew by every book position (≤ 575 KB, Sicilian); `pipeline/tsconfig.json` maps `$lib` so the
pipeline can share `judge.ts`.
