---
tags: [concept, risk, open-question]
aliases: [Engine licensing, GPL]
---

# Engine licensing

**Open question. Flagged 2026-09-15, deliberately not resolved.**

## The issue

[[Stockfish]] is **GPL-3.0**. Serving the WASM to a browser **is distribution**, which means the
JavaScript that links it inherits the copyleft obligation. This is exactly why Lichess is AGPL —
it is not a hypothetical reading.

## Why it matters here

It does not matter at all for a personal drilling tool. It matters if this ever becomes the product
described in [[Lineage — from lethality analyzer to drilling tool]], which had an explicit paid tier
and a domain already registered.

## Options

1. **Keep the whole app GPL.** Free, honest, fine while it is a tool for one person. Forecloses a
   closed paid tier.
2. **Move the engine server-side.** Run Stockfish behind an API; the client never receives GPL code.
   The usual reading is that this avoids distribution — though AGPL would not allow it, and GPL-3
   over a network boundary is a well-trodden but not risk-free path. Costs: server, latency, no
   offline.
3. **Swap engines.** A permissively-licensed engine, at some strength cost.

## Decide before

Anything commercial. Anything with a signup. Not before then.

Related: [[Decision Log]] · [[Stockfish]]
