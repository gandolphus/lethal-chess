---
tags: [concept, history]
aliases: [Lineage]
---

# Lineage — from lethality analyzer to drilling tool

Why `lethal-chess` is not what `lethalchess.com` was going to be, and what was kept.

## What came before

Two sibling projects in `~/projects/`:

- **`chess-lethality-analyzer`** — working MVP. FastAPI + React. Ingests Lichess monthly archives
  (`.pgn.zst`), builds an opening tree, scores each node for *lethality*, renders it as a heat-tinted
  spider diagram filterable by rating band.
- **`pre-lethalchess`** — the coming-soon landing page for lethalchess.com, plus the product concept
  doc.

## The idea worth keeping

Engine tools show the **best** move. That project asked which move **wins against humans at your
rating** — a different question. Its composite score weighted opponent error rate above engine
soundness roughly 7:1:

```
L = P^0.30 · E^0.35 · C^0.25 · R^0.10 · S^0.05
      popularity, opponent error, conversion, rating relevance, soundness
```

A dubious line that wrecks 1400s outranks a "correct" one. That inversion is the differentiator, and
it is still the interesting bit.

The concept doc also framed three tiers — Pure Path (explore) → Ascended Path (exploit) → **The
Ladder** (become), the last being a performance-based training loop of
*Expose → Challenge → Reveal → Drill → Apply* over clusters like Blunder Punishment and Opening
Exploits.

## What changed on 2026-09-15

Scope narrowed to **the drilling tool alone** ([[Decision Log]]). In the old framing, that is the
Ladder — the third tier — built first and built alone, without the visualizer or the tier structure
around it.

The bet: a tool that is useful to one person every day beats a product concept with a landing page.
Everything the analyzer built still exists and is not deleted; the Lichess pipeline is what
[[Opening Drills]] will need if it is to drill *what opponents actually get wrong* rather than just
a personal repertoire.

## Where the old code lives

- `~/projects/chess-lethality-analyzer` — `backend/app/scoring.py` holds the formula;
  `backend/app/lichess_cli.py` the ingestion.
- `~/projects/pre-lethalchess` — concept doc + landing page.

Neither is a dependency of this repo.
