---
status: accepted
date: 2026-09-16
tags: []
---
# "Trippy" is a family (Prism), and what makes it possible is a capability of the contract (a scene)

The owner's [[Eye candy themes]] brief left one question open: is the LSD theme a family like the other
eight, or an intensity dial on every theme? **A family.** A dial makes every theme slightly worse at being
itself, multiplies what has to be tested by sixteen, and "soothing hyperspace" is a look, not an amount.
But "the better base we get for it, the more potential we can squeeze out of it" is the real instruction,
and it is answered by making motion and depth **something any theme may declare, not a special case for
one**: a family may carry `scene`, which becomes `data-scene` on the root, the board and the swatch —
additive, like `data-board` and `data-font` — and tokens for three things: fixed backdrop layers
(`--scene-far/tint/near`), a hue veil colour-blended *under* the board's marks (`--veil`), and a piece sway
(`--sway-ms`). Without the attribute nothing is generated, so the fifteen existing palettes are untouched;
`palettes.test.ts` freezes their tokens and the pixel diffs in Round 5 show 0 differing pixels on the
pages measured. Rules that fell out of measuring: keyframes hold no `var()` (Chrome then runs the animation
on the main thread — 690 ms of style recalculation per six seconds until fixed), everything animates
`transform`/`opacity` only, and every fixed layer is a full-screen GPU fill per frame, so there are three.
Where elegant-and-soothing and trippy pulled against each other, soothing won: veil chroma .06/.045 rather
than .11, nothing moving in under six seconds, the tint no longer breathing. No WebGL: the compositor
carries all of it with the main thread asleep (6 ms in six seconds on a throttled phone profile), which
no draw loop matches. Details and numbers in [[Eye candy themes]] and [[Visual Design]].
