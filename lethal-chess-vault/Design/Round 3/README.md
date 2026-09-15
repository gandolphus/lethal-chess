---
tags: [design, fable, exploration, recommendation]
aliases: [Round 3, Design Round 3, Exploration design]
---

# Round 3 — making discovery feel like exploration

Fable 5.1, 2026-09-16. Three static prototypes for [[Exploration Mode]], built on the token contract in
[[Visual Design]]. They run from disk (double-click) with the real Ruy Lopez line data as mock progress:
12 found, 7 entered, the learner three moves into the Berlin Defense, Rio de Janeiro Variation. Each has a
theme switch (Obsidian, Night, Graphite, Amethyst, Alabaster) and a reduced-motion switch bottom right;
`?theme=alabaster` also works. Critique of the current page: [[Critique]]. Screenshots: `shots/proto-*.png`.

| File | Direction | Open with |
| --- | --- | --- |
| `line-map.html` | **The chart** — the shelf under the board and the fog-of-war line map | `?view=map`, `?view=map&zoom=overview` |
| `board-moments.html` | **The trace** — anticipation on the board, a one-second celebration | `?ply=13` (trail), `?ply=16` (celebration), `&motion=reduce` |
| `atlas-picker.html` | **The shelf of openings** — the picker as a collection | — |

Static server, if wanted: `python3 -m http.server 5182 --bind 127.0.0.1 --directory "lethal-chess-vault/Design/Round 3"`.

---

## 1 · The chart (`line-map.html`)

![[proto-map-overview-obsidian-desktop.png]]

**Idea.** The opening drawn as what it is: a tree of lines, x = move number, one band per variation,
biggest first. What the learner has found is lit (`--ok`), what they have entered is warm (`--accent`,
solid up to the move they reached, dashed beyond), and everything else is **fog**: the structure of the
secret lines is drawn as dotted `--text-3` strokes with hollow ends and *no names, no moves*. The learner
sees that the Closed variation is a deep fan of 33 lines and that they have touched one edge of it — the
map is complete in silhouette and empty in detail, which is exactly the state of their knowledge.

- **Two zooms, no continuous zoom.** *Overview* fits the width, 7 px rows, band names and counts only.
  *Detail* is 46 px per ply with move labels on every edge the learner has actually played and names on
  the ends they have reached; it scrolls both ways. The phone opens the map as a sheet in Overview.
- **Sidelines.** The 15 single-line variations of the Ruy Lopez become one "Sidelines" band, so the chart
  has 20 bands, not 34. The Sicilian's 259 lines should be judged the same way (its band list is longer;
  bands collapse on tap in the real thing — not prototyped).
- **The shelf** (under the board in the board view) is the same data folded once: one segment per
  variation, width ∝ lines, lit part = found, warm part = entered, fog texture = secret. The variation
  being played has a ring. Hover names it; click opens the map at that band. It costs 40 px of height and
  gives the page a shape that changes as the learner progresses.
- **Where you are** is a warm dot with a slow ring on the exact node the game has reached (one CSS
  animation, off under reduced motion).

**Judgement.** This is the identity piece: nothing in a chess app looks like it, and it is honest about the
data (every stroke is a real line; every branch is a real branch). Risk: at Detail the tall bands (Closed:
33 leaves) have empty space on the left because a tidy tree fans late — Overview is the right default, and
the real component should let a band collapse.

## 2 · The trace (`board-moments.html`)

![[proto-celebrate-mid-obsidian-desktop.png]]

**Anticipation.** From a line's entrance, every square a move has landed on gets a small wedge in its
top-right corner, in `--accent` at 70 %. Six moves into a line, six wedges; they say "you're on a path and
it's this long" without arrows and without covering pieces. The pips in the line card stay as the count.

**Celebration, ~1.2 s, board never covered.**
1. A light sweeps once around the board's outer edge (a 3 px conic-gradient ring, `--ok`, 1 s).
2. The line's moves are replayed as short strokes, entrance to end, 90 ms apart, with a dot on each
   landing square and a ring on the last; the overlay fades and is removed at 1.6 s.
3. A mote leaves the last square, arcs to the counter in the panel, and the counter rolls 12 → 13.
4. The line card turns green and shows the line's moves under the name. The wedges turn green, then leave.

Under `prefers-reduced-motion` (or the switch): no sweep, no strokes, no mote; the ring shows still for a
second, the counter changes, the card appears. Nothing on the page loops, ever.

**Judgement.** Fixes the critique's main complaint — the moment finally happens where the eye is — and
lands in about a second. Risk: the strokes cross pieces for 0.7 s; the sweep and the mote are the parts to
keep if that proves too much. The counter moving to the top of the panel on phones (as in the prototype) is
what makes the mote's destination visible.

## 3 · The shelf of openings (`atlas-picker.html`)

![[proto-picker-obsidian-desktop.png]]

**Idea.** The picker as a collection. Each card keeps its mini board, name and moves, then carries the same
**spine** as the Explore page's shelf: the opening's variations as segments, found lit, entered warm,
secret fogged. An untouched opening is a fully fogged spine — "34 lines, none found yet" — and the fog
itself is the invitation. Under the spine one line says the count; the variation count sits opposite.
Each side heading carries its tally ("17 of 878 lines found"). The hero's featured board becomes "Continue
where you left off" once there is progress, with the opening's spine and the last variation played.
Lethality becomes five quiet dots in `--text-2` instead of red bars.

**Judgement.** Cheapest of the three and it reuses the shelf component exactly, so it should ride along
with direction 1. The per-variation placement of the lit segments needs data the picker doesn't have yet
(see mapping); the honest v1 is the real segment widths with the found/entered proportion laid from the
left.

---

## Recommendation: build the trace first, with the shelf; then the chart; then the picker

1. **Board moments + the shelf** (a few days). Highest impact per hour and no new data: everything comes
   from `ExploreSession.following`, `progress`, `events` and `summarize()`. Ship with the three zero-cost
   fixes from the critique: sentence-case kicker instead of the tracked eyebrow, reserve the line card's
   height so a celebration never shifts the buttons, and derive the notice title and text from the same
   move so they can't contradict.
2. **The chart** (about a week). One new component behind the shelf's "Open the map" and the panel's
   "Map" button; the phone sheet is the same component in a fixed container.
3. **The picker spines** (a day) once `index.json` carries variation sizes.

### Component mapping

**`Board.svelte`** — two additive props, both optional, both rendered inside the existing `.area`:
- `trail: Square[]` → `class:trail` on the square (the wedge is a `::after`, ~10 lines of CSS next to
  `.hint`/`.correct`). Source: `explore.game.uciHistory.slice(explore.following.entry).map(uci => uci.slice(2, 4))`
  — add it to `ExploreSession` as a `$derived` next to `marks` so the page stays declarative.
- `trace: { from: Square; to: Square }[] | null` → one more `<svg viewBox="0 0 800 800">` next to
  `.arrows`; square centres are `(file * 100 + 50, rank * 100 + 50)` in that viewBox, so no
  `getBoundingClientRect` is needed on the board side. Wrap it in `{#key event.id}` so each discovery
  restarts the stroke animations; they are CSS `stroke-dashoffset` keyframes with `animation-delay:
  calc(var(--i) * 90ms)`. Source: `celebration.lines[0].moves.slice(celebration.lines[0].entry)`
  (`IndexedLine.moves` are UCI) — the `celebration` derived in `+page.svelte` already isolates the event.
- The sweep is a `::before` on `.board-wrap` toggled by a `celebrate` class the page sets from
  `{#key celebration.id}`; the `@property --sweep` conic gradient is in the prototype's CSS verbatim.

**The mote and the counter** — page-level (`src/routes/openings/[id]/+page.svelte`). Read the end
square's rect from the board's DOM (`[data-square=…]` inside the board column) and the counter's rect
(bind the count element), one `element.animate()` on a fixed `<span>`, then bump the count. The count
should update optimistically from the event (`summary.sound.discovered + 1`) rather than waiting for
`refreshStats()`, whose round trip through `recordDiscovery` is what the roll animation hides.

**`LineShelf.svelte`** (new, used by the Explore page under the board and by the picker) — props:
`variations: { name; total; discovered; entered }[]`, `here?: string`. Source on the Explore page:
`summary.variations` from `summarize(book, stages)` plus `explore.following?.variation`. Variations
with `total === 1` fold into "Sidelines". Pure CSS (the fog is a `repeating-linear-gradient`), no SVG.

**`LineMap.svelte`** (new) — props: `lines: IndexedLine[]` (from `book.lines`; has `moves`, `entry`,
`entryName`, `variation`, `name`, `dubious`), `stages: Map<string, LineStage>` (the page already builds
it with `stagesOf(discoveries)` to hand to `ExploreSession`; keep the reference and bump a version on
`onDiscovery`), `here: { line: IndexedLine; index: number } | null` (from `explore.following` and
`game.uciHistory.length`), and a `played: Map<string, number>` for entered lines, which the session does
not keep today: add it to the `Discovery` record as `plies` when stage is `entered` (one integer; the
outbox and D1 column are additive). Move labels: lines carry UCI, and the map labels only non-fog edges
(≤ 30 lines at any time), so convert with one `Chess` walk per labelled line, cached by line key — or add
`san: string[]` to `BookLine` in `pipeline/repertoire/build.ts` (≈ 15 KB on the Sicilian bundle). Layout
is the prototype's `trie()` + `place()` per band, ~80 lines, no library. Transpositions: two catalog lines
that end in the same position share a key and therefore a stage; draw both paths, both light up.

**Picker** (`src/routes/+page.svelte`) — it already loads `found[opening.id]`; the spine additionally
needs each opening's variation sizes: emit `variations: number[]` (sizes, descending) into
`static/openings/repertoires/index.json` from `pipeline/repertoire/build.ts`, next to `lines`. Per-variation
accuracy of *which* segment is lit needs the line key → variation map, which lives in the bundle; defer,
and lay the found/entered proportion from the left as the prototype does.

### Performance budget (measured on the prototypes, headless Chromium, 1400×1000)

| Thing | Measured | Budget |
| --- | --- | --- |
| Map, Detail, Ruy Lopez (146 sound lines) | 931 SVG elements, 504 paths, built in 4.1 ms | ≤ 2,000 elements and ≤ 30 ms for the Sicilian (259 lines); build on open, not on page load |
| Map, Overview | 724 elements, 3.5 ms | same; re-render on discovery by rebuilding (≤ 5 ms) — no diffing needed |
| Map motion | one CSS ring animation | nothing else animates; off under reduced motion |
| Shelf | ≤ 21 elements, static | re-render only when `summary` changes |
| Celebration | 7 ms of script, 13 overlay elements, all removed by 1.6 s | ≤ 16 ms script (one frame); ≤ 8 layout reads batched before any write; transform/opacity-only animations for the mote and the counter; no `setInterval`, no rAF loops |
| Picker | 361 spine segments across 28 cards, pure CSS | ≤ 1,000 extra elements; no JS per card |
| Bundles | — | `variations: number[]` in `index.json` ≤ 2 KB; optional `san` per line ≤ 15 KB per bundle |

### Not prototyped, worth doing

- Bands that collapse on tap in the map (the Sicilian will need it).
- A short "what the map shows" line the first time the map opens, then never again.
- The one-move sidelines ("Brentano Gambit": entered and discovered at once) could be the map's easy
  first lights — the computer already steers toward unfound lines; the map makes that steering visible.
