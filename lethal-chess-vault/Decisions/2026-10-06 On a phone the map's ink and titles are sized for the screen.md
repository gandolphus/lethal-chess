---
status: accepted
date: 2026-10-06
tags: [line-map, mobile]
---
# On a phone the map's ink and titles are sized for the screen

The owner, on a phone: the lines could not be made out, "grey on top of dark blue", and the tree titles
must stay readable while staying aligned with their trees.

Cause: the fitted phone map is drawn at about 0.3 of its chart size, and every stroke, dot and label
was in chart units, so lines rendered at about a third of a pixel and titles at about 3px.

**Chosen:**
- **Ink scales against the zoom.** `ink = clamp(1/scale, 1, 4) × (touch ? 1.3 : 1)` multiplies stroke
  widths, dashes, bead and node sizes (CSS vars on the SVG). Capped so a chart pinched right out
  does not fill its own gaps.
- **Found and in-progress lines get a soft halo** underneath, so what has been found reads first.
- **The undiscovered colour comes from the theme:** `--text-2` leaning toward `--accent`, so it contrasts
  in every theme and sits in the theme's hue instead of a fixed grey.
- **Touch layout gives each band a title row** (`Layout.strip`) above its tree. The title is about 11px
  on screen at the fit, and the tree starts directly beneath it. The gutter drops from 180 to 24 chart
  units, which narrows the chart, so the fitted map is drawn larger overall.

**Rejected:**
- *`vector-effect: non-scaling-stroke`* — its dash handling varies by browser, and it doesn't cover
  dot or node sizes.
- *Bigger titles in the gutter* — at the fit scale the gutter is about 50px wide, so a readable title
  overlaps the tree. Widening the gutter shrinks the fit and the problem returns.
- *HTML labels pinned over the SVG* — they would have to track pan and pinch by hand, and drift.
