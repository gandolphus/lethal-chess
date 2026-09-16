---
tags: [feature, planned, design]
aliases: [Visual Design, Themes, Aesthetics]
---

# Visual Design

> **Typeface is its own setting (2026-09-16).** A theme used to decide the type as well as the colours, so
> choosing a board look changed the reading experience. Settings has a **Typeface** section, kept last
> because pieces matter more — Match the theme, Editorial, Grotesque, Technical, Geometric, Fabulous,
> System — stored alongside theme and piece set and applied as `data-font` on `<html>`. The `[data-font]`
> blocks sit after every `[data-theme]` block in `app.css`: same specificity, later wins. "Match the
> theme" sets no attribute. `?font=…` previews one, like `?theme=` and `?pieces=`.

> **Geometry is fixed across themes (2026-09-16).** A theme changes colour, board treatment *and*
> typeface, and different faces have different metrics. Switching a theme used to reflow the settings page
> by a few pixels — the option under the cursor moved. Now the site nav has a fixed height, the footer a
> minimum height, the swatch's mini board is `border-box` (its grid gap no longer changes the swatch's
> height), and the settings page pins its own `--font-ui`/`--font-display` and re-reads them with an
> explicit `font-family` (inheritance passes the resolved family, so setting the token alone did nothing).
> Each theme's typefaces are shown *inside* its swatch as "Aa Ruy Lopez" instead. Measured: every element
> on the settings page is pixel-identical across Obsidian, Graphite and Night.

**Status: in exploration — Fable 5.1 commissioned for direction + a working prototype (2026-09-15).**

> "I'm really big on aesthetics. Try a dark theme — maybe a few different ones. And some light themes
> too. But most importantly the pieces, the board, everything, has to look modern and striking. Not
> distracting. I want to make the coolest looking chess app out there."

## The brief as constraints

- **Several dark themes and several light themes**, all first-class. Light is not dark inverted.
- **Pieces are the biggest lever.** The current Unicode glyphs are a placeholder. Either an open
  piece set (licence matters — some Lichess sets are GPL/CC-BY-SA, and this may become a product) or
  a custom SVG set.
- **Striking but not distracting.** Drill sessions are long and focused.
- **Every drill state is themed, not bolted on:** pass/soft/fail flashes, hint arrows, legal-move and
  capture markers, last move, check, selection, promotion picker, drag ghost.

## Architecture constraints already locked

- A **token system** every theme implements; components consume only tokens.
- Board stays DOM + SVG; effects may use a WebGL overlay canvas later, as a framework-agnostic module
  ([[Decision Log]] 2026-09-15 on graphics).

## Round 1 (2026-09-15)

[[Round 1 — review]] — solid system (tokens, blend rules, feedback decay, licence survey), but the
seven themes are palette swaps of one calm, conventional look. Doesn't meet "coolest looking" yet.
Awaiting the user's reaction before round 2.

## Round 2 (2026-09-15)

[[Round 2 — review]] — three directions with real character: Material, Instrument, Nocturne. User
disliked Material's piece contours; asked that **all themes from both rounds be selectable in settings**
rather than picking one.

## Ported into the app + UI overhaul (2026-09-15, Fable 5.1)

- **13 themes** (7 from round 1, 6 from round 2), one token contract in `src/app.css`, each with a
  structural `board` style (flat / material / instrument / nocturne). Default: Obsidian.
  `?theme=…&pieces=…` previews any look without saving.
- **7 piece sets**: Monolith, Material, Instrument, Nocturne (ours), Chessnut (Apache-2.0),
  cburnett (GPLv2+, public since the AGPL decision), Glyph. Licence files ship next to the assets.
- **Bugs fixed in the port:** Nocturne's glow hid pieces (now below them); cburnett black pieces
  rendered grey and inconsistently (tinted from the wrong token, and paths without a fill attribute
  kept SVG's default black) — reported by the user, diagnosed, fixed with inherited fills.
- **Evaluation bar** (user request, chess.com-style): beside the board, learner's colour at the bottom,
  fill from the *same* winning-chances model as the verdicts so the two can never disagree; horizontal
  on phones; styled per direction.
- **Overhaul** of every page: hero + three-step strip and mini boards on the picker, a *Lethality* meter
  from `opponentSharpness`, one status card on the drill page ("whose move, what happened, what next"),
  keyboard shortcuts (N/K/L/P), phone layouts, `/settings/preview` for design review.

**Found in review, fixed by the main agent:** the retry screen revealed the expected move (the retry
must be unhinted); Ruy Lopez showed maximum Lethality because one mate-in-1 position scored 99,935 in
the mean — sharpness is now capped (1,000 cp per position, 300 per position in the opening average).

## Fabulous collection (2026-09-15, Fable 5.1)

Requested by the user's friend: a purple board, "fabulous but playable". Themes **Amethyst** (dark) and
**Wisteria** (light) on the Material board style, and the **Regalia** piece set — baroque turned forms,
accent-coloured jewels on king and queen that pick up each theme's accent colour.

Legibility trade-offs taken deliberately: highlight fills are orchid rather than gold (gold on
saturated purple turns muddy), iridescent sheen kept at 7% with no animation, black pieces a
desaturated plum so they separate from dark squares.

### Fabulous redesign (same day)

User: the first version "doesn't look that nice… the frame looks tacky, the letters overlap with the bevel,
the gradient gives it a 90's feel". Fable (with the frontend-design skill) removed the frame entirely —
no gradient, no bevel, one gold hairline around the playing area, coordinates in clear space. Squares
became violet velvet (#4f2e80) against champagne (#e2d4c9); lilac highlight fills, gold rings and arrows;
ebony black pieces with gilt lines, ivory white pieces with dark outlines; larger amethyst jewels
(`--jewel` token) on king, queen and bishop; Fraunces + Jost. Ids unchanged so saved choices carry over.
User: "much better".

## Round 3 — Exploration mode (2026-09-16, Fable 5.1)

[[Critique]] of the Explore page and picker (the moment happens off-stage; the counter is last; the
picker is a catalogue of identical thumbnails) and three prototypes in `Design/Round 3/`, all built from
the token contract with four derived tokens (`--fog`, `--ember`, `--lit`, `--trail`): **the chart**
(fog-of-war line map + a shelf under the board), **the trace** (anticipation wedges on the board, a
one-second celebration: edge sweep, move replay, a mote into the counter) and **the shelf of openings**
(picker cards with per-variation spines). Recommendation and component mapping in
[[README|Round 3 README]]: build the trace with the shelf first, then the chart, then the picker.

## Pending

The user's hands-on reaction; favourite theme as default; self-hosting the Google Fonts faces. The previous Catppuccin Mocha palette in `src/app.css` came from the planning vault
and is **not** a constraint on the app's look.
