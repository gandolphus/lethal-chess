---
tags: [feature, planned, design]
aliases: [Visual Design, Themes, Aesthetics]
---

# Visual Design

> **Theme families, dark or light (2026-09-16).** Settings no longer shows the build history ("Round 1",
> "Round 2 · Material"…). Every theme is a **family with a dark and a light side**, and Dark / Light is
> its own control above the list; the swatches flip with it. Families, in the order shown (quiet to loud:
> flat boards first with the default among them, neutral → warm → cool → green; then the structural
> boards by how far they leave a plain board; Fabulous last as the one ornament):
>
> | Family | Board | Dark | Light |
> |---|---|---|---|
> | Stone | flat | Obsidian | Gallery |
> | Timber | flat | Ember | Paper |
> | Tide | flat | Abyss | Porcelain |
> | Grove | flat | Moss | **Sage** (new) |
> | Material | material | Onyx | Alabaster |
> | Instrument | instrument | Graphite | Vellum |
> | Nocturne | nocturne | Night | Dawn |
> | Fabulous | material | Amethyst | Wisteria |
>
> Moss had no light side, so **Sage** was drawn for it: celadon paper (`#eef1e8`), sage squares
> (`#e4e8d3` / `#7f9a72`), straw highlights that multiply to olive, and an ochre accent (`#8f5f0e`,
> 4.8:1 on the page) because Moss's pale gold vanishes as text on a light page. Palette ids are unchanged,
> so `?theme=night` and every saved choice still work. The store keeps `family` + `mode`; a record from
> before (`{theme: 'night'}`) maps to its family and side on load. `?mode=light` flips whichever theme is
> on; next to `?theme=` it picks that family's other side. **Default mode follows
> `prefers-color-scheme` until a mode is chosen here**, and only a chosen mode is written, so a visitor who
> never touched it keeps following their device. Piece sets lost their group labels too; the names stay.
> Measured after the change: the settings page is pixel-identical across Stone, Instrument, Nocturne and
> Fabulous in both modes (see the geometry note below).

> **Chessnut's black pieces (2026-09-16).** The owner: "the outline features are mixed between a more
> dimmed outline and white outline". With the artwork open: Chessnut's black pieces have **no outline** —
> a filled silhouette with the drawing (`#f2f2f2`) traced just inside its edge. On a mid-tone square the
> dark rim is the edge and the drawing is detail; on Night's or Graphite's near-black squares the rim melts
> into the square, the near-white `--pbh` drawing became the visible outline, and the dim rim around it read
> as a second one. The `BLACK_EDGE` fix earlier that day targeted `#000` strokes, which these pieces don't
> have, so it did nothing and is gone. Now the set's black line-work — strokes and the knight's mane fill
> alike — is `color-mix(--pbh 70%, --pb2)`: engraving on a black shape whose edge is the body against the
> square, as drawn. Cburnett is untouched (dark outline, full-highlight details), so the sets stay apart.
> No edge stroke was added: the drawing sits a few units inside the edge and a stroked edge would run
> parallel to it as a doubled line.

> **One light line per black piece (2026-09-16).** The owner, after the Chessnut fix: some black pieces
> still got different outline colours in some themes. Black pieces are `--pb1`/`--pb2` body, `--pbs` edge,
> `--pbh` detail. Most themes keep the edge near-black, so the detail is the only light line and nothing can
> clash. Graphite and Night are the two whose edge is itself light; Graphite had `--pbs == --pbh`, Night had
> `#93a7c8` against `#cfdcf2`, so the knight's mane, the king's cross and cburnett's engraving sat near-white
> on a blue-grey edge while the pawn stayed a plain silhouette — three "outlines" on one board. Nocturne's
> rim filter flooded a hard-coded `#d6e8ff` (and `#6f86ad` underneath) on every theme, a light of its own.
> Both candidates were rendered across all seven sets: at `#cfdcf2` the black side became hollow line
> drawings hard to tell from white; at `#93a7c8` it stayed silhouettes with a moonlit rim, the theme's own
> brief. So Night's `--pbh` is now `#93a7c8`, and the rim floods `var(--pbh)` — the highlight token is the
> one light a black piece may carry, so the rim matches the edge in Night/Graphite and the detail colour
> (Obsidian's grey, Onyx's stone) elsewhere; `flood-color` resolves `var()` since the filter lives in the
> page. `src/lib/theme/tokens.test.ts` reads `app.css` and asserts `--pbh == --pbs` in every theme whose
> edge is lighter than its body. White pieces untouched.

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
> on the settings page is pixel-identical across Obsidian, Graphite and Night. **Method:** drive headless
> Chromium over CDP to `/settings`, click a theme (and now a mode), wait 700 ms, read
> `getBoundingClientRect()` of `main`, `.mode`, `.options`, the first and fifth theme option, the first
> piece and font option, the second section and the footer, plus `scrollHeight`; the tuples must be equal
> for every theme while `body`'s computed font family changes.

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
