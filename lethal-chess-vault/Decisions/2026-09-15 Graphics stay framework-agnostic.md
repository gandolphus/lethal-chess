---
status: accepted
date: 2026-09-15
tags: []
---
# Graphics stay framework-agnostic

Asked whether shaders/WebGL later would favour React. Conclusion: **no — shader work happens outside
the framework either way.** You mount a canvas, hand it to a renderer, and keep the framework away
from it.

Therefore the rule: any future render layer ships as a **plain TS module with a
`mount(canvas, opts) → { update, destroy }` API**, exactly like [[Stockfish]] and [[chess.js]] are
today. The framework wraps ~20 lines around it. This keeps the SvelteKit decision cheap to reverse
and is why `src/lib/chess/*` imports nothing from Svelte.

Corollary: the board is **DOM/SVG now, WebGL overlay canvas later** — not WebGL from day one.
Crisp text, trivial hit-testing, effects composite on top.
