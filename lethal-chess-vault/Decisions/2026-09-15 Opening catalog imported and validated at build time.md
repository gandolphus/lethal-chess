---
status: accepted
date: 2026-09-15
tags: []
---
# Opening catalog imported and validated at build time

`scripts/build-catalog.js` fetches `lichess-org/chess-openings` and replays all 3,810 lines through
[[chess.js]], failing the build on any mismatch — the review flagged SAN drift between catalog and
rules engine as a risk, so it is caught at build time rather than mid-drill. Output
`static/openings/catalog.json` is committed (derived data, reproducible via `pnpm catalog:build`).
