---
status: accepted
date: 2026-09-16
tags: []
---
# The line map

- **Layout is a pure module** (`src/lib/explore/linemap.ts`: bands, trie, tidy placement, edge states),
  rebuilt wholesale on every change rather than diffed: a few milliseconds even for the Sicilian, and
  it is unit-tested against the real bundle for the ≤ 2,000-element budget.
- **An entered line's end stays secret.** The prototype named entered ends with their entrance name; the
  built map draws a hollow warm end and no name, and writes moves only on edges the learner has played.
  What the learner hasn't reached must not be readable off the map.
- **Discovered lines are lit end to end**, not just past the entrance: every edge of a discovered line was
  played. The prototype's muted "known" trunk was dropped.
- **Overlay, not a board swap.** The map opens over the page (a bottom sheet on phones) so the Explore page's
  layout is untouched and the component stays self-contained. It is built only while open.
- **Dubious lines get a band** at the bottom rather than being hidden, consistent with the page's separate
  "Dubious lines" list.
