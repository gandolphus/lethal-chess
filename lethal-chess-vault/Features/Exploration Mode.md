---
tags: [feature, idea, flow]
aliases: [Exploration Mode, Line Discovery]
---

# Exploration Mode

**Status: idea, raised by the user 2026-09-15 — not designed or built. Discuss before building.**

> "Instead of expecting the user to follow fixed lines we could design the app around exploration. All
> lines are secret, but we show an 'x out of n lines discovered' statistic somewhere appropriate. When the
> user discovers a move which leads to an established line we celebrate, and we keep playing whenever the
> user makes good moves instead of interrupting the flow."

## Context

It came up while deciding how Learn mode should teach. Current Learn shows the move with an arrow;
the alternative on the table was "guess first" with a hint ladder (idea → piece → arrow) and computed
"why" lines ([[Opening Drills]]). This idea goes further: no prescribed line at all.

## Pieces it would build on

- Bundles already store every named line (catalog names on positions) and engine grading for any move
  ([[Data sources]], [[Public MVP]]).
- [[Coached Free Play]] already keeps playing past the book with verdicts and natural replies — the
  "don't interrupt good moves" behaviour exists there.
- Named-line positions give a natural "discovery" event (entering a catalog-named position).
- [[Progress Tracking]] would add a discovered-lines count per opening, possibly alongside the planned
  line-mastery measure.

## Open questions

- What counts as a "line" for x/n: catalog-named positions in the bundle, or leaf paths of the tree?
- Does exploration replace Learn, or sit beside Learn/Practice as a third mode?
- How does spaced repetition fit when the path is the learner's own choice?
- What happens on a sound move that leads to no named line — continue with engine replies, or steer back?
- Celebration design that stays "not distracting" ([[Visual Design]]).
