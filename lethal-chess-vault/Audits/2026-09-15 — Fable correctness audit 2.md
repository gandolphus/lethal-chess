---
tags: [audit, code, fable]
aliases: [Fable correctness audit 2]
---

# 2026-09-15 — Fable 5.1 correctness audit #2

Read-only audit of the pipeline, repertoire builder, drill core, and refactors written after
[[2026-09-15 — Fable code audit]]. Evidence-based: scratch scripts simulated 20,000 drill walks per
bundle and cross-checked 135,725 cache records against the raw eval db. Fixes: [[Decision Log]]
"Audit #2 fixes".

| # | Sev | Finding | Status |
|---|---|---|---|
| 1 | high | Replies point at positions never expanded (budget cut-off) → 55–99% of walks end after an opponent move, asking nothing | **fixed** — prune; re-simulated: 0.0% |
| 2 | med | Eval db repeats PVs verbatim (≈3.8% of multi-PV records); cache and bundles shipped them | **fixed** in builder (cache keeps source verbatim) |
| 3 | med | Theory bonus (up to ~8) outranked engine rank (≤ 1): sound replies truncated for one-line theory | **fixed** — sound seated first, theory weight capped |
| 4 | med/low | Coverage counted passes after a forced reveal | **fixed** — first tries only |
| 5 | low | `responseMs` cumulative across attempts | **fixed** |
| 6 | low | Three tests would pass on broken code (FSRS rating, "transposition" without one, malformed-line path) | **fixed** (first two); malformed path noted |
| 7 | low | `stop()` misses a search queued behind the lock (latency only) | open |
| 8 | low | `cardsBelow` memo inside repetition cycles (no cycles in bundles) | open |
| 9 | low | Duplicate-key survivor rule differs from `chooseEval` (0 duplicates in practice) | open |

**Verified correct:** cache integrity (0 mismatches over 135,725 records, mates, castling stored
verbatim), White-POV convention, all five bundles legal with consistent SAN, learner moves within
tolerance, reply weights, sharpness sign, names, reachability, grading and FSRS mapping, the
retry/reveal state machine, Date revival, arrow geometry under Black orientation.
