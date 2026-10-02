---
status: accepted
date: 2026-09-15
tags: []
---
# Lethality is back in scope, rebuilt from real data

Reverses part of "Scope narrowed to a drilling tool" below, the same day. The user's goals now
include classifying every opening by strength and drilling its weaknesses — which *is* the lethality
pipeline. Drilling stays the product; classification becomes the content it drills.
See [[Opening Classification]] and [[2026-09-15 Fable design review|2026-09-15 — Fable design review]].

**`scoring.py` is not ported.** The review showed, and we confirmed at `aggregate_store.py:305`,
that all five factors of the old formula were derived from one number — the mover's score rate.
"Engine soundness" was `(score_rate − 0.5) × 420`, not engine output. The replacement keeps
objective cost (real evals) and practical edge (Elo- and colour-corrected results by band) as
**two separate numbers**, never blended by fixed weights.
