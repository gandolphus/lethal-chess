---
status: accepted
date: 2026-09-15
tags: []
---
# Classification is an offline native build; the app ships static data

Analysis runs offline with native [[Stockfish]] + python over the Lichess game dump and eval db,
not in the browser — WASM is ~10× slower with no parallelism. Output is per-opening JSON bundles,
lazily loaded; still no backend. All three data sources are **CC0**; the explorer API is not
crawled. Offline engine use is not distribution, so the shipped data carries no GPL obligation.
See [[Data sources]].

Positions are keyed by **EPD** (FEN minus move counters) so transpositions share stats and cards;
opening names live on paths, not positions.
