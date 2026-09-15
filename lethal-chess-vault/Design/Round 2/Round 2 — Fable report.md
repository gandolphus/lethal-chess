# Lethal — design round 2: three art directions

Prototype: `prototype.html`, hash-driven — `#direction=material|instrument|nocturne&variant=dark|light&state=drill|correct|soft|wrong|check|promo|drag|focus&view=app|sheet|small`, plus `nomotion=1` (freezes every animation at its peak for screenshots). Screenshots in `shots/`: `<direction>-<variant>-<state>.png`, `pieces-<direction>-<variant>.png` (12 pieces at 176 px on both squares), `small-<direction>-dark.png` (360 px board).

Round 1's rules are kept: one token set per variant (six blocks at the top of the file), light ≠ inverted dark, feedback decays into state, nothing loops, `prefers-reduced-motion`. All three piece sets are drawn from scratch in the file. Fonts are OFL: Fraunces + Figtree, Geist + Geist Mono, Jost.

The panel shows the real product: track name, move list, verdict card (pass / "sound, but not your line" / fail with cost), engine eval, "precision demanded" meter, session strip, track proficiency (coverage / retention / precision). No reply-frequency statistics.

---

## 1 · Material — onyx / alabaster

**Concept.** A chess set as a luxury object: inlaid stone tiles with a micro-bevel and grout, a chamfered frame with the coordinates engraved in it, pieces that are lit rather than drawn. Striking because nothing else renders pieces with real light; calm because the light is static and nothing on the board glows.

**Pieces.** Turned Staunton-family forms composed from primitives (union silhouettes), passed through an SVG lighting filter: `feGaussianBlur` on the alpha → `feDiffuseLighting` (form shading, key light upper-left, 58°) multiplied into a vertical gradient fill → two `feSpecularLighting` passes (a tight key specular, and a warm rim from lower-right that separates black pieces from dark squares) → a blurred contact-shadow ellipse for ambient occlusion. An outline pass under the fill pass carries the silhouette. King: closed crown with a cupped flare and cross; queen: five curved spikes with finials; bishop: full mitre with a real evenodd cut; knight: full-cheeked head, two ears, grooved mane.

**Tokens.** Onyx: squares `#958c81 / #5a5452`, grout `#1e1c1f`, frame `#2c2a2f→#1a191c`, brass accent `#d9b56d` (sel 40 %, last 20 %), ok `#79d6a4`, soft `#f2c94c`, bad `#f0715e`. Alabaster: squares `#ebe4d8 / #b6a690`, straw multiply highlights `#e6cf7c / #efe2ac`, teal arrow `#1f6e72` (the one contrasting element), ok `#2c9b62`, soft `#d59d16`, bad `#d1493a`.

**Motion.** Move 260 ms with a lift (scale 1.08, shadow grows). Correct: fill + ring settles into last-move brass over 1.4 s. Wrong: 2.5 % shake, then dims. Soft: gold settles to a faint tint + ring.

**Risks / cost.** Lighting filters on 32 `<use>` instances re-rasterise on every transform; fine at 80 px, but 4K and drag must be measured — fallback is baking lit pieces to WebP per variant at build time. Black-on-dark relies on the rim highlight, not the stroke (2.6:1 on onyx dark squares).

## 2 · Instrument — graphite / vellum

**Concept.** The product is a precision drilling tool, so the board is an instrument: hairline grid, a ruler around it with major ticks at square edges and minor ticks at half-squares, coordinates centred under their squares in a monospaced face, corner brackets like a viewfinder. Monochrome plus exactly one signal colour (`#ff6a1a` / `#ee5a0c`). Striking because nothing in chess looks like it; calm because the screen is grey until the position demands attention.

**Pieces.** Ruler-and-compass construction: straight cuts, 45° chamfers on the plinths, perfect circles, a diamond finial on the bishop, a five-spike queen, a three-point king crown, a faceted knight with a square eye. Flat fill with a hairline outline drawn with `vector-effect: non-scaling-stroke` — the line weight is 1.3 px at every board size, like a CAD line weight, which is why black pieces (near-black fill, light hairline) still read on a 45 px square.

**Feedback is engineered too.** Selection and last move are monochrome. Legal moves are crosshairs, captures a reticle. Pass = white ring; fail = solid signal fill; soft = signal *hatching* (drafting for "provisional") — the verdicts differ in pattern, not only hue, so deuteranopia-safe by construction. Check = signal reticle on the king. Hint = signal hairline, open head.

**Tokens.** Graphite: squares `#2b2d33 / #1a1b1f` (1.25:1 — the grid `#40434b` carries the structure, so round 1's 1.6:1 rule is deliberately broken here), text `#ebebed`, signal `#ff6a1a`. Vellum: squares `#f5f4ef / #cbc9bf` (1.5:1), ink `#17181a`, signal `#ee5a0c`. Pieces: white `#e9e9eb` on `#101114`, black `#0b0c0f` on `#c9ccd3`; on vellum black pieces take an ink hairline.

**Motion.** 170 ms, near-linear ease, no lift — mechanical. No shake on fail: a hard cut to the signal fill that steps down to a residual.

**Risks / cost.** Cheapest to build (no filters, no gradients). The low square contrast is a real accessibility trade and needs testing on a poor monitor. The orange verdicts (fail solid, soft hatched) must always be echoed in the panel, which they are.

## 3 · Nocturne — night / dawn

**Concept.** A deep-navy board where **light is the feedback medium**. Selection is a pool of moonlight that spills past the square, legal moves are points of light, the hint is a beam (blurred duplicate under the arrow), a pass blooms green-white and settles into the last-move pool, a fail blooms red and dims to an ember, check is a red pool around the king. Striking as a film still; calm because light appears only in answer to the player.

**Pieces.** Elongated, waisted glass forms — smaller heads, thinner stems, elliptical collars, cushion bases, an ogee king crown — so the set is not Material's silhouette in a different coat. Rendered as a vertical gradient with an edge-light filter: the rim is computed from the silhouette (`SourceAlpha` minus the same alpha offset 2.2 units down = every upward-facing edge), blurred, tinted, merged on top. White pieces are moonlit silver, not white.

**Tokens.** Night: squares `#232a38 / #151a25`, accent `#8ec6ff` (sel pool 55 %, last 26 %), beam `#cfe6ff`, ok `#7ff0c4`, soft `#ffd37a`, bad `#ff6b6b`, black-piece rim `#d6e8ff`. Dawn: squares `#eef1f6 / #b9c3d2`, ink pools `#93a8ec / #c3d0f2` multiplied, arrow `#3e5fd0`, ok `#24a06c`, soft `#d69a1c`, bad `#d7453b`.

**The light-variant question, honestly.** Light-as-medium does not invert: on a pale surface a bloom of light is invisible. Dawn keeps the *geometry* (pools, points, beam) and swaps the medium for ink — pools multiply into the surface like watercolour. It is pleasant (`nocturne-light-drill.png`) but the weakest of the six variants: foggy, and the pieces lose the rim story. Recommendation: ship Nocturne dark-only and pair it with **Alabaster** as the light theme — the two share nothing but token names, which is the point of the token system.

**Motion.** 300 ms glide, brief brighten at the apex. Blooms scale .4→1.2→1 in 45 %, then hold at 85 % (a faint ring keeps the residual legible under a piece). Nothing pulses.

**Risks / cost.** Radial pools and the beam blur are cheap; the rim filter is one blur per piece, far lighter than Material's lighting. Unusable in a bright room — hence the pairing. Black pieces on dark squares depend on the rim (stroke 5.8:1 against dark squares is fine on its own).

---

## Head-to-head

| | Material | Instrument | Nocturne |
|---|---|---|---|
| Identity | luxury object | precision tool | cinematic |
| Says what the product *is* | partly | **yes** | partly |
| Calm over 40 minutes | yes | yes | yes (dark rooms) |
| Piece distinctiveness | high (lighting) | high (construction) | medium-high (rim) |
| Light variant | **excellent** | good | weak |
| Legibility at 45 px | good | good (non-scaling stroke) | acceptable |
| Implementation cost | highest (filters) | lowest | low-medium |
| Accessibility risk | black-on-dark rim | square contrast | dark-only |

## Recommendation

**Instrument for the frame, Nocturne for the dark board, Alabaster for the light board — and one piece set.**

1. **Chrome and panel: Instrument.** Hairline rules, Geist/Geist Mono, gauges with ticks, the session strip, hatched "soft". It says "precision" without copy and is cheapest to build.
2. **Dark board: Nocturne's light vocabulary** (pools, points, beam, blooms) inside Instrument's ruler frame. The ruler is static and monochrome, the light is dynamic; they do not compete.
3. **Light board: Alabaster** — ceramic tiles, straw multiply highlights, teal arrow — inside the same frame. Best light theme of the six by a distance.
4. **Pieces: one set.** Material's silhouettes, Nocturne's rim rendering on dark, Material's lighting on light; keep the raster-bake fallback for the filter cost. Instrument's faceted set is the alternate "engineer's set" worth offering as a user option because it survives a 45 px board without help.

Do not ship all three as themes: three characters are three ideas, and the app should have one.

## Still weak

- Nocturne dawn is honest but not shippable; it exists so the decision is informed.
- Material's white pieces are still a touch glossy at 190 px; matte stone wants a lower specular exponent and a grainy normal (`feTurbulence`, cheap, untested).
- Knights are the best-drawn pieces in all three sets; queens are the least resolved (Instrument's spikes read as a crown but not as *the* queen beside the king at 45 px).
- Screenshots freeze animations at 0.5 s (the peak), not the settle — open the file to see the decay.
