---
status: accepted
date: 2026-09-15
tags: []
---
# Eval data: stream once, keep a temporary cache, discard

One streamed pass over the eval db, keeping positions with ≥ 26 pieces (the opening phase) as a local
cache: measured ~14 min single-thread at ~490k lines/s, est. **5–17 GB depending on encoding**.
Enough to expand all three repertoire trees *and* all 3,810 catalog openings without re-streaming.
The raw 22 GB file is never stored. The cache is deleted once the shipped bundles are built, per the
user: "discarded as soon as they've outlived their use". Details in [[Data sources]].
