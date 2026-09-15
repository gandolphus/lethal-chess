---
tags: [design, review, fable]
aliases: [Design Round 1]
---

# Design Round 1 — review

Fable 5.1's first visual pass for [[Visual Design]], 2026-09-15. Full report:
[[Round 1 — Fable report]]. Open `prototype.html` in a browser; the URL hash drives it, e.g.
`prototype.html#theme=ember&pieces=chessnut&state=wrong`.

![[obsidian.png]]
![[abyss.png]]
![[paper.png]]

## What it got right — keep regardless of direction

- **Token architecture.** ~40 tokens per theme; nothing else knows a theme exists.
- **Light ≠ inverted dark.** Light themes `multiply` highlights, dark themes alpha-blend; highlight
  hue sits next to the board hue, and only the arrow may contrast.
- **Feedback decays into state.** A correct flash settles into the last-move colour; a wrong move
  shakes then dims. Nothing loops.
- **Licence survey** of every Lichess piece set (table in the report). The pretty sets are almost all
  CC BY-NC-SA — unusable. Custom set recommended, **chessnut (Apache 2.0)** as fallback.
- **Monolith**, a custom geometric piece set: knight and pawn good, queen and bishop placeholders.

## Our honest assessment

Well-made, calm, coherent — **but it does not meet the brief yet.** The brief was "the coolest
looking chess app out there". This is a refined Lichess:

- **The seven themes are palette swaps.** Same flat squares, same layout, same silhouettes; only hue
  changes. They differ in colour, not character.
- **Pieces are the conventional Staunton silhouette,** drawn cleanly. Nothing a person would remember.
- **The report chose restraint on purpose** ("striking is cheap, striking and calm is the job"). The
  principle is right; the execution leans so far toward calm that "striking" went missing.
- Contrast issue: black pieces on Abyss's dark squares are low-contrast.
- The side panel shows reply frequencies — a rating-based idea the precision-first direction removed.

## Proposed round 2

Keep the token system and the rules above. Explore **character**: three genuinely different art
directions, each a full hero screen, before committing to palettes. And the piece set is the
differentiator — no permissive set is striking, so a custom set is not optional.

## Licensing note

The prototype inlines **chessnut** (Apache 2.0) and **cburnett** (GPLv2+) for comparison. The raw
third-party SVGs Fable downloaded were deliberately *not* kept in the vault.
