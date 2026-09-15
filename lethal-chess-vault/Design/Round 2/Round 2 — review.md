---
tags: [design, review, fable]
aliases: [Design Round 2]
---

# Design Round 2 — review

Fable 5.1's second pass for [[Visual Design]], 2026-09-15, exploring *character* after
[[Round 1 — review]] found round 1 to be palette swaps. Full report: [[Round 2 — Fable report]].
Served at `http://127.0.0.1:5181/prototype.html` —
`#direction=material|instrument|nocturne&variant=dark|light&state=drill|correct|soft|wrong|check|promo|drag|focus&view=app|sheet|small`.

![[material-dark-drill.png]]
![[instrument-dark-drill.png]]
![[nocturne-dark-drill.png]]
![[material-light-drill.png]]

## The three directions

- **Material (onyx / alabaster)** — inlaid stone tiles with bevel and grout, chamfered frame with
  engraved coordinates, pieces *lit* through an SVG diffuse + specular lighting chain. Reads as a
  luxury object. **Alabaster is the best light theme across both rounds.**
- **Instrument (graphite / vellum)** — ruler ticks around the board, corner brackets, crosshair legal
  markers, reticle captures, one signal orange. Feedback differs by *pattern* (soft = hatching), not
  just hue. The most on-brand: it says "precision" without copy.
- **Nocturne (night / dawn)** — light as the feedback medium: moonlight pools for selection, points of
  light for legal moves, red/green blooms for verdicts, glass pieces with a computed rim. The most
  cinematic. Dawn (light) is not shippable, by Fable's own assessment.

## Fable's recommendation

Combine rather than pick: **Instrument's frame, chrome and panel** + **Nocturne's light vocabulary**
on the dark board + **Alabaster** as the light board, with **one** piece set (Material silhouettes,
Nocturne rim on dark, Material lighting on light).

## Our verification of the screenshots

- **Bug — Nocturne hides pieces under its glow.** In `nocturne-dark-drill.png` the white knight on c3
  (selected) and the black knight on d5 (capture target) are *not rendered* — only their light pools
  are. Same in `nocturne-dark-wrong.png`. The glow layer sits above the pieces. Must be fixed before
  anything from Nocturne ships.
- **Instrument's black pieces on dark squares are hard to read** at screenshot scale (thin hairline on
  near-black). Fable flagged the 1.25:1 dark squares as deliberate; on this evidence it is too far.
- Material's pieces are the most legible of the three and its board has the most presence.
- The side panel now reflects the product correctly (eval, precision demanded, session, proficiency;
  no rating stats). Its example fail text is hand-written chess prose — fine as a mockup, but the
  product rule stands: explanations come from engine lines and computed facts, not free LLM text.

## Decision

Pending the user's choice. Round 1 remains available in `Design/Round 1/` (served on :5181's sibling
port :5180).
