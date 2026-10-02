---
status: accepted
date: 2026-09-17
tags: []
---
# A screen with a board on it is an app shell, and the panel is what scrolls

The owner, testing [[Exploration Mode]] on a phone: *"The view is still too big so let's take a look at
how to fit everything in order to not need scrolling on the page."* The standing rule — *"a chess
interface shouldn't feel like a website"* — had been applied per-screen and had drifted. Explore spilled
15px at 390×844 (the mode row and the sheet button were the part below the fold) and 20px at 390×667.

**The shape, now the same on `/today`, `/play` and every `/openings/[id]/[mode]`:**

```
main    display: flex; flex-direction: column; max-height: calc(100dvh - 3.25rem)
.layout display: grid; grid-template-rows: auto minmax(0, 1fr); align-items: stretch
board   width: min(100%, calc(100dvh - var(--chrome)))
panel   min-height: 0; overflow-y: auto
```

The board yields width before the panel yields room, and past that the **panel** scrolls — never the
window. Three things had to be right and each was found by measuring, not by reading:

- **`align-items: start`** is inherited from the two-column desktop layout. A grid item aligned to start
  takes its own content height, overflows its `1fr` row, and takes the window with it. It must be
  `stretch` on a phone. This alone was the whole 20px at 667.
- **Grid, not a column flex.** A stretched flex item's cross size is not definite while it is being
  sized, so the board's `width: min(100%, …)` resolved `100%` against *min-content* — a 97px board. A
  grid track is definite, so the percentage resolves.
- **`--chrome` is per-screen** (23rem in a session, 24rem on `/today`, 22rem on `/play`), because what
  hangs under the board differs. At 844 nothing shrinks; the budget only bites on short phones.
