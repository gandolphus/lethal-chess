---
status: accepted
date: 2026-09-15
tags: []
---
# Repertoires organised as catalog-named tracks, not one chosen line

Repertoires: **English (White), Sicilian (Black), Caro-Kann (Black)** — the user wants proficiency
in "all aspects", especially the aggressive English lines and those demanding the most precision from
the opponent.

Rather than forcing an upfront choice ("which Sicilian?"), each named catalog line is a **track**
(`Sicilian Defense: Najdorf Variation, English Attack`), and names give a family hierarchy for free
(Sicilian → Najdorf → English Attack). Tracks are what you choose to study and what proficiency is
measured on. See [[Opening Drills]] and [[Progress Tracking]].

**"Most precision demanded from the opponent" is computable**: at each opponent-to-move position,
how many moves stay within tolerance of best, and how far the second-best falls. The eval db stores
5 candidate lines for most opening positions, which is exactly this. **"Aggressive" is not directly
computable** — approximated by that sharpness score, refined by hand-tagging. Stated plainly so
nobody mistakes the proxy for the thing.
