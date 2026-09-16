---
tags: [feature, built, design, theme]
aliases: [Eye candy, Trippy themes, Living themes, Prism, Scene, Nebula, Iris]
---

# Eye candy themes

**Status: built 2026-09-16 (Fable 5.1), on a branch, awaiting the owner's eyes.** The theme family is
**Prism** — **Nebula** (dark) and **Iris** (light) — and the thing that made it possible is a new capability
of the token contract, a **scene**, that any theme can declare. Screenshots and the measuring scripts are in
[[Design/Round 5/README|Round 5]].

> "What kind of *eye candy* stuff could we get up to with theming? It would be cool to make the visual
> theme **super trippy** with various effects. Like an LSD theme, where the backdrop is in the middle of
> hyperspace (but in an elegant and soothing way), the board's colours shift in a multitude of hues, and
> the pieces sway like they're in a trance… The better base we get for it, the more potential we can
> squeeze out of it."

## The decision: a family, and a capability

"Trippy" is a **family** like the other eight, not an intensity dial on every theme. A dial makes every
theme slightly worse at being itself, multiplies what has to be tested by sixteen, and "soothing hyperspace"
is a *look*, not an amount. See [[Decision Log]] 2026-09-16.

But the owner's last sentence is the real instruction, and it is answered separately: what makes Prism
possible is not a special case for one theme but three things the contract now knows how to do. Today only
Prism uses them; any family could.

## The base: a scene

A family may declare `scene: 'hyperspace'` (`ThemeFamily.scene` in `settings.svelte.ts`). That becomes
`data-scene` on `<html>` (set by the root layout next to `data-theme`), on the board's wrap and on the
settings swatch — an additive attribute exactly like `data-board` and `data-font`. **Without the attribute,
none of the following exists in the DOM**, which is how the calm themes pay nothing (proof below). With it,
the theme's tokens paint three things:

| Part | Tokens | What it is |
|---|---|---|
| **Backdrop** | `--scene-far`, `--scene-tint`, `--scene-near`, `--scene-near-ms` | Three `position: fixed` layers behind the page at `z-index: -1`: the depth with its tint painted over it in one still layer (`:root::before`), and two copies of the same points of light (`body::before/::after`) that each grow out from the centre and fade as they go, half a cycle apart, so the field always has stars arriving — sailing through, not warping. |
| **Veil** | `--veil`, `--veil-ms`, `--veil-blend` | A hue gradient the board carries in a clipped strip three boards wide that drifts one board width per period, **blended over the squares with `mix-blend-mode: color`**. That blend lends hue and saturation and leaves luminosity alone, so a light square stays exactly as light as its token and a dark one as dark whatever hue is passing. The strip sits at `z-index: 0` after every square and every mark on a square is lifted to 1, so `correct` / `soft` / `wrong`, the hint ring, check, the legal-move dots, arrows and the discovery trace are never tinted. The gradient repeats every `100cqi`; Prism's runs at 112° and uses `--veil-span: calc(100cqi * 0.927)` so its period along its own line matches. |
| **Sway** | `--sway-ms` | Two pendulums with unrelated periods (`--sway-ms` and 1.37×): a lean of ±1.6° about a point near the base, and a drift of ±0.8 % up and down, so the motion never repeats exactly. They animate the individual `rotate` and `translate` properties, never `transform`, and they live on a wrapper (`.sway`) *inside* `.piece-slot` that exists only under a scene — so the slot's own `transform` stays free for the piece-movement FLIP landing on main, and the `<svg>`'s for its set. Each piece starts at its own phase from `swayPhase(index)` in `src/lib/theme/scene.ts` — golden-ratio scatter, so neighbours are never in step and never chaotic (tested). The amplitude is the board's, as ring widths are; the theme sets only the tempo. |

Every animation is `transform` or `opacity`, so the compositor carries it. Two rules learned the hard way,
now written into the CSS comments: **keyframes must not contain `var()`** (Chrome will not composite such an
animation and recalculates style for it every frame — the first version cost 690 ms of style recalculation
per six seconds), and **every fixed layer is a full-screen fill on the GPU each frame**, which is why the
tint breathes no more and shares the far layer.

`?board=material` (any of the four) is a new preview override alongside `?theme=`, `?pieces=` and
`?font=`: it puts another family's board treatment under the palette, never stored, so a scene can be
judged under all four. The settings page names it.

## Prism

**Nebula.** Deep indigo (`--bg: #07060f`), surfaces as glass over the starfield (`rgba(20,17,40,.74)`),
squares lavender at rest (`#a39dbe` / `#443e62` — the veil sets the hue, these set only how light each
square is). The far layer is a tunnel lit at its vanishing point behind the board; the tint is three
nebulae in violet, teal and rose; 34 stars. Every hue passes under the marks, so the marks are the two
colours no hue can be: `--ring` and `--hint` are white, `--sel` and `--last` are white light at 30 % and
20 %, and the feedback colours are the brightest of their kind (`--ok #8dffcf`, `--soft #ffe27a`,
`--bad #ff5c6c`). Jost with Instrument Serif; `--move-ms: 320ms`, the slowest theme.

**Iris.** The inside of the light: white paper (`#f4f2fa`) with the spectrum soft on it, fourteen motes of
light instead of stars, squares `#efecf6` / `#9a92ba`. Light-mode fills multiply, so the highlights are a
lilac that multiplies to a clean violet on any hue; the feedback colours are the dark ones a light page
needs. Same veil at a pastel chroma.

**Where elegant-and-soothing and trippy pulled against each other, soothing won, three times:**

1. **Chroma.** The `color` blend keeps the veil's full RGB spread, and the first veil at oklch chroma .11
   was a rave — teal, magenta and orange squares. It ships at **.06 (Nebula) and .045 (Iris)**: dusky
   mother-of-pearl rather than a rainbow. The spectrum is still all there, one full cycle across the board's
   width, but you notice it as the hues *change* rather than as colour shouting.
2. **Tempo.** Nothing moves in under six seconds: the veil crosses the board in 40 s, a star takes 36 s to
   sail past, a piece leans for 7 s each way. The board's own feedback (settle, shake, bloom) is the only fast
   thing on the screen, so it reads as an event against a slow field — which is the legibility argument as
   much as the taste one.
3. **The tint no longer breathes.** It cost a fourth full-screen layer for an effect barely perceptible at
   48 s.

What was given up: at this chroma the board is not what anyone would call "super trippy" in a still; the
trippiness is in the motion, and a screenshot undersells it. If the owner wants it louder, the two levers
are the veil chroma (one number per palette) and `--veil-ms`.

## Legibility

- Squares: luminosity is preserved by the blend, so light/dark contrast is the tokens' own at every hue.
- Marks: never under the veil; white rings on Nebula, violet on Iris, feedback colours at the luminosity
  extremes. Checked on the preview page (every mark and arrow kind) under all four board treatments and
  with Monolith, Chessnut, Cburnett, Nocturne and Regalia pieces. Instrument's hatched "soft" square and
  reticle, Material's tiles and Nocturne's pools all work under the veil.
- **Reduced motion** is a composition of its own, not a frozen frame: the far layer with its tint, one field
  of stars mid-way out at full strength (the second copy hidden), the veil still — a spectrum laid across the
  board — and the pieces standing.

## Cost, measured

Headless Chromium, 390×844 @2x with a coarse pointer, CPU throttled 4× (Lighthouse's mid-range phone
profile), the preview board with every mark and arrow, a 6-second window. `Design/Round 5/src/perf.mjs`.

| | fps | p95 frame | gaps > 25 ms | main thread | compositor | GPU process (software) |
|---|---|---|---|---|---|---|
| Obsidian, idle | | | | 3 ms | 0 | 1 ms |
| **Nebula, idle** | | | | **6 ms** | **210 ms** | **1553 ms (≈ 4.3 ms/frame)** |
| Obsidian, rAF loop running | 60.0 | 16.7 ms | 0 | 91 ms | 50 ms | 19 ms |
| **Nebula, rAF loop running** | **60.0** | **16.8 ms** | **0** | **1163 ms (≈ 3.2 ms/frame)** | 254 ms | 1627 ms |
| Iris, idle | | | | 177 ms | 419 ms | 1605 ms |

Reading it: a learner looking at the board costs the main thread nothing (6 ms in six seconds) — the
engine's Worker and the UI keep the whole core. When the main thread is producing frames anyway (a drag,
or a page animating in JS), each frame carries ~3 ms of re-syncing the 65 composited animations at 4×
throttle; 60 fps still held with no frame over 25 ms. The one real cost is GPU fill: three full-screen
layers plus the veil, roughly 9.5 Mpx per frame at 2× — comparable to a fixed background under a scrolling
list. If battery on a weak GPU ever matters, the lever is the second star layer (one layer with a fade at the
loop point halves the backdrop's fill). Measured per part: sway ≈ 0 idle / ~700 ms per 6 s of main thread
only while frames are being produced; veil ≈ 470 ms of software GPU; backdrop ≈ 1000 ms.

No WebGL, no canvas: the CSS version rides the compositor with the main thread asleep, which no draw loop
can match; a shader could draw a better tunnel, and that is the trade if one is ever wanted.

## Proof the fifteen palettes did not move

- `src/lib/theme/palettes.test.ts` freezes every pre-existing `[data-theme]` block's tokens in
  `palettes.frozen.json` (generated from the stylesheet before this work): a palette block may not change
  or lose a token; the default block may gain tokens, never change one. 20 tests.
- Pixel diffs in headless Chromium (`Design/Round 5/src/diff.mjs`), 1,400,000 pixels a page, the same
  page with every changed file at HEAD against this branch (`pages.sh`, `bisect.sh`): the picker, Play
  (Gallery), the preview board under Night, Onyx/Material, Vellum/Instrument and Dawn/Nocturne — **0 pixels
  differ**. Settings under Amethyst and Obsidian differ only at the scrollbar thumb (x ≈ 1392–1397), which
  is shorter because a ninth card makes the page taller. Two smaller deltas turned up and were run down:
  3 corner pixels at delta 1 on the Obsidian preview and 24 pixels at delta 1 on one edge of the picker's
  step strip — both appear in some runs and not others with identical files (the Obsidian one with every
  file at HEAD, the picker one in a run whose DOM was HEAD's on that page), so they are the rasteriser
  between runs, not the change.

## Files

- `src/app.css` — contract header, defaults, the two Prism blocks, the scene layers, reduced motion.
- `src/lib/components/Board.svelte` — `data-scene`, the veil, mark stacking, sway.
- `src/lib/theme/settings.svelte.ts` — `Scene`, `scene` on family and theme, the Prism family, `?board=`.
- `src/lib/theme/scene.ts` (+ test) — `swayPhase`. `src/lib/theme/palettes.test.ts` (+ frozen json).
- `src/lib/theme/ThemeSwatch.svelte` — far layer as the swatch's ground, the veil in the mini board.
- `src/routes/+layout.svelte` — two lines: `data-scene` on the root. `static/theme.js` — the Prism row.

## Open

- The scene appears after hydration (the boot script sets only theme/mode/font); a fade-in was not added
  because the star layers begin from opacity 0 anyway and the far layer's arrival is a soft cut.
- A second scene would tell whether the tokens are the right granularity: an "aurora" with a moving far
  layer would want `--scene-far-ms`, which does not exist yet on purpose.
