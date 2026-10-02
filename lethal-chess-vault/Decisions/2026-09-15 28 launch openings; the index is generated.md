---
status: accepted
date: 2026-09-15
tags: []
---
# 28 launch openings; the index is generated

User: "all the popular ones and some not so popular ones if they have potential, or are especially
aggressive." `pipeline/repertoire/spec.ts` now lists 28 (13 White, 15 Black) with groups and tags
(popular / aggressive / gambit / system / solid). The builder writes `repertoires/index.json` — the
single list the app reads (the hand-maintained `launch.ts` duplicate is gone). Budget raised to 180
learner decisions, maxPly 22. Less popular lines have more positions without cached evals (up to 72,
London System) — a native-Stockfish fallback in the pipeline ([[Off-book Practice]] needs it too) would
deepen them.
