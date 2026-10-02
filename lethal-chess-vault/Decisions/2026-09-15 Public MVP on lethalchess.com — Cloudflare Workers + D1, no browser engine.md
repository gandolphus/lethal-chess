---
status: accepted
date: 2026-09-15
tags: []
---
# Public MVP on lethalchess.com: Cloudflare Workers + D1, no browser engine

User direction: "Build an MVP where a novice can start practicing pretty well, with a database and
Google auth so data is saved… put it on lethalchess.com… send a link to a friend and have them
practice the Ruy Lopez." Scope: [[Public MVP]].

**Architecture — analysis is offline, the site does no chess computation:**
1. *Offline, locally:* the pipeline precomputes every tree position's candidate moves, evals,
   engine lines, names and sharpness → static per-opening bundles.
2. *Browser:* the whole drill. Grading a move is a lookup in the bundle. Moves outside the data
   are still gradeable (worse than every stored candidate). Free exploration past the data can call
   Lichess cloud eval directly — **verified `access-control-allow-origin: *`**.
3. *Cloudflare:* static site + bundles on the CDN; a small Worker for Google sign-in, sessions and
   the attempt log; **D1** (SQLite, 30-day point-in-time recovery) for storage.

**Hosting: Cloudflare Workers + D1** over a VPS — the domain is already on Cloudflare (verified:
serving the "Coming Soon" page), zero servers to maintain. **Supersedes** "Persistence is SQLite on
disk via the SvelteKit server": that was right for a local tool, not a hosted multi-user one. The
append-only attempt log and derive-everything principle carry over unchanged; only the engine changes.

**No Stockfish in the public app.** Drills never needed it; only play-vs-computer does. Shipping
GPL-3.0 WASM publicly would oblige publishing source ([[Engine licensing]]); launching without it
keeps that decision open. Play-vs-computer stays in local builds.

**Launch openings (default, user may extend):** Ruy Lopez and Italian Game (the novice entry point)
plus the user's English, Sicilian and Caro-Kann.
