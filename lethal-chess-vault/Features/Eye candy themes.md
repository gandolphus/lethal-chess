---
tags: [feature, idea, design]
aliases: [Eye candy, Trippy themes, Living themes]
---

# Eye candy themes

**Status: idea, raised by the owner 2026-09-16. Not designed. A dedicated Fable agent is the plan.**

> "What kind of *eye candy* stuff could we get up to with theming? It would be cool to make the visual
> theme **super trippy** with various effects. Like an LSD theme, where the backdrop is in the middle of
> hyperspace (but in an elegant and soothing way), the board's colours shift in a multitude of hues, and
> the pieces sway like they're in a trance… The better base we get for it, the more potential we can
> squeeze out of it."

## The point

Today a theme is a set of CSS tokens: colours, fonts, four board treatments ([[Visual Design]]). That
contract is what made 15 themes cheap — and it is also the ceiling. Nothing in it can move, glow, refract
or breathe. The ask is to raise the ceiling deliberately: a **base capable of motion and depth**, with
the calm themes as one point on it and hyperspace as another.

## What a base might need

- **A backdrop layer** behind the board — animated gradient, canvas or WebGL — that a theme can opt into,
  with the whole app still readable over it.
- **Colour in motion**: hue rotation over time, per-square phase offsets, so the board shifts without the
  squares losing their identity.
- **Piece motion**: a slow sway or shimmer that never moves a piece off its square, and never competes
  with the board's own feedback (`correct` / `soft` / `wrong`, hint arrows, the discovery trace).
- **Composition rules** so effects stack without turning to mud: a budget per theme, not a free-for-all.

## Constraints that must survive

- **Legibility first.** Squares must stay distinguishable, pieces must stay identifiable, and the
  feedback colours must keep their meaning. The precision of the tool is the product.
- **`prefers-reduced-motion`** must give a still, beautiful version — not a broken one.
- **Cost**: the engine already runs in the browser (a Web Worker), and phones run this app installed.
  A backdrop that eats a core is not acceptable; measure frames and battery.
- **The token contract stays** — the calm themes must not need rewriting, and new effects should be
  additive attributes (like `data-board` and `data-font` are today).

## Open questions

- Does the effect live behind the board, around it, or on the squares themselves?
- Does a "trippy" theme also change the pieces' geometry, or only their motion?
- Is this one family (dark/light like the rest, per the 2026-09-16 theme work) or a separate axis a
  learner turns up and down — an *intensity* setting?
