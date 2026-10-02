---
status: accepted
date: 2026-09-15
tags: []
---
# Engine analysis collects multi-PV per depth

Verified against the real WASM engine in Chromium: a search stopped by movetime mid-depth mixes ranks
from two depths and can list the same move twice (seen: `Nc3` at ranks 4 and 5). `MultiPvCollector`
keeps lines per depth and returns the deepest *complete* set, deduplicated. A unit test reproduces the
real output.
