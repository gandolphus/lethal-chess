---
status: accepted
date: 2026-09-15
tags: []
---
# Audit #2 fixes: drill trees end on learner decisions

[[2026-09-15 Fable correctness audit 2|2026-09-15 — Fable correctness audit 2]]: the builder stopped at its card budget leaving replies that
pointed at unexpanded positions, so 55–99% of drill walks ended right after an opponent move with no
decision asked. Fix: `pruneDanglingReplies` — replies must lead to a learner decision, weights
renormalised, unreachable nodes removed. **Re-running the audit's own 20,000-walk simulation: 0.0%
dangling, 3–10 decisions per walk (mean 5.3–6.3).** Also fixed: duplicate PVs from the eval db
(deduplicated in the builder), sound engine replies now seated before thin catalogued theory,
coverage counts first-try passes only, per-attempt response time, and three tests that would have
passed on broken code.
