---
tags: [design, fable, theme, measurement]
aliases: [Round 5, Prism round, Scene round]
---

# Round 5 — Prism, and the scene the contract gained

Fable 5.1, 2026-09-16. The write-up is [[Eye candy themes]]; this folder holds the evidence.

## Shots (`shots/`)

Desktop 1400×1000 unless named otherwise; `phone/` is 390×844 @2x with a coarse pointer. The Prism shots
are JPEG (a starfield PNG is a megabyte; `shrink.mjs`); the proof shots are PNG because they are compared
pixel for pixel.

- `prism-{nebula,iris}-board-{flat,material,instrument,nocturne}.jpg` — the preview board (every mark and
  arrow) under each of the four board treatments, via `?board=`.
- `prism-{nebula,iris}-pieces-{chessnut,cburnett,nocturne,regalia}.jpg` — other piece sets (the board
  shots are Monolith).
- `prism-{nebula,iris}-reduced-motion.jpg` — `prefers-reduced-motion: reduce` emulated.
- `prism-{nebula,iris}-settings.jpg`, `prism-{nebula,iris}-openings.jpg` — the settings page (Prism last
  in the list) and, by mistake, the 404 page, which is a fair look at the backdrop alone.
- `before-*` / `after-*` — Obsidian and Night before and after the change, pixel-diffed (see the feature
  note). `head-*` / `now-*` — six more pages, every changed file at HEAD against this branch, same run.

## Scripts (`src/`)

- `cdp.mjs` — the owner's harness, with `send`, `socket()` and `media()` added; profile dir moved to /tmp.
- `prism.mjs` — the matrix above. `ONLY=quick` for two shots; `MOBILE=1` for the phone.
- `perf.mjs` — frames and thread time per theme, idle and with a rAF loop; `PARTS=1` switches off sway,
  veil and backdrop in turn. `perf-sway.mjs` — which ways of writing the sway the compositor takes.
- `diff.mjs` — pixel comparison of two tagged shot sets, in the browser. `before.mjs`, `pages.mjs`,
  `pages.sh`, `after-check.mjs`, `bisect.sh` — the before/after proofs. `probe.mjs` — what is animating.
