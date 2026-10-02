---
status: accepted
date: 2026-09-17
tags: []
---
# The map is a map: it opens fitted, and a pinch zooms it

*"The map should start in a zoomed out mode so that most of the map is visible, then the user needs to be
able to zoom in and out, similar to how google maps does it."* On a phone the chart is about 1422 × 3688
in a 388 × 595 frame — **four per cent of it visible**, which is why it read as a corner rather than a map.

**The layout never changes; only what is drawn is scaled.** `layout()` is still computed once for the
panel's width, and zoom multiplies the SVG's `width`/`height` while the `viewBox` stays put. So the tree
keeps its shape, nothing reflows under the fingers, and text stays vector-crisp at any scale.

- **A phone opens at `fit`** — the full breadth of the opening, which is the axis that carries meaning,
  and about 60% of the height. Not fit-to-both, which for a phone would be 0.16 and unreadable.
- **A desktop opens at 1**, its natural size. Fitting there shrank a chart that already fitted well
  enough to read, for no gain; zoom on a desktop is something the reader asks for. The split is on
  `(hover: none) and (pointer: coarse)` — the same signal the chart already used for row heights —
  not on width, so a narrow desktop window keeps a desktop's map.
- **A pinch reaches exactly `min`** — the scale at which the whole chart is in the frame. "Show me
  everything" is one gesture and never overshoots into nothing. Floor of 0.06 for a very tall chart.
- **Zoom is anchored**: whatever is under the fingers stays under them. This is the whole difference
  between a pinch that feels like a map and one that feels like a slider. A pinch grabs **one chart
  point** at the start and every event of the gesture is measured against that same point, rather than
  re-derived from the last frame's scroll offset — which is what stops a hundred events drifting. The
  point is held against wherever the fingers are *now*, so two fingers pan as well as zoom.
- **A trackpad pinch is `ctrl`+wheel**, which is what the browser sends — so the laptop gesture is the
  same gesture, exponential so a stream of small deltas is smooth and one mouse notch is a step.

The cost: `touch-action: none` on the scroller, because the browser would otherwise answer two fingers by
zooming the whole page. Taking one gesture means taking both, so one-finger panning is now ours too —
which loses the browser's flick momentum. Worth revisiting if it is missed.

**Caught on the way**, and older than this change: a drag or pinch ended by arming a one-shot capture
listener to swallow the click it would produce. A pinch usually produces no click, so the listener stayed
armed and ate the *next real tap* instead. Now a flag, cleared when the next gesture starts.

### The centring bug, and what it teaches

First version shipped and the owner reported the map "cropped": *"after having zoomed in it seems the
panning can't reach the edges"*, and zoom not holding its point. One cause for both.

The scroller centred its chart with `display: flex; justify-content: center`. **A flex container that
centres content wider than itself splits the overflow to both sides, and the half that goes left of the
scroll origin cannot be reached at any scroll position.** Measured: 1164px of chart in a 388px frame gave
a scroll range of 388 instead of 776, with the chart's left edge pinned at −388. The same offset also
made the anchor arithmetic wrong, because it assumed the chart's origin was at `scrollLeft: 0`.

Centring is now `margin-inline: auto` on a block chart, which **resolves to zero once the child is the
wider of the two** — so it centres when the chart is small and adds no offset when it is large. The
offset is a term in the maths either way (`centerOffset`), rather than something the layout does behind
the arithmetic's back.

Rule worth keeping: **never centre a scroll container's overflowing content with flex or grid
centring.** `margin: auto` on a block child, or `justify-content: safe center`.
