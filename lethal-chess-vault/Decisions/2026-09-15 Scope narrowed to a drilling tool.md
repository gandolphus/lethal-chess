---
status: accepted
date: 2026-09-15
tags: []
---
# Scope narrowed to a drilling tool

The product is **a tool for drilling openings**, not the "Chess Lethality Visualizer" described in
`../pre-lethalchess`. The lethality premise (train against *human* failure patterns, not engine
best-play) survives as the eventual differentiator, and the FastAPI + Lichess ingestion pipeline in
`../chess-lethality-analyzer` is left intact to be pulled back in later. See
[[Lineage — from lethality analyzer to drilling tool]]. Building the daily-useful thing first.
