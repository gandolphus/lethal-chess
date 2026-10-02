---
status: accepted
date: 2026-09-15
tags: []
---
# Full eval cache built and validated

129,235,757 positions (≥ 26 pieces) from 409,710,113 lines, **8.27 GB, 12.5 min**, 0 duplicates,
0 malformed. **Coverage of all 7,855 catalog positions: 99.5%** — 100% through ply 17, 98% at 18–19,
92% at 20. 84.5% of hits carry ≥ 3 candidate moves, 80.1% depth ≥ 30. All 831 king-takes-rook
castling moves are legal after normalisation. King's Gambit spot check agrees with cloud eval.
Report: `node pipeline/eval-cache/coverage.ts`. Raw 22 GB kept until the tree builder is proven,
then deleted.
