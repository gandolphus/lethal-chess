# Lethal — visual direction

Prototype: `prototype.html` (open it, or add `#theme=ember&pieces=chessnut&state=wrong` to the URL). Screenshots in `shots/`. Nothing here touches the repo.

## 1. What the good ones do, and where they stop

- **Lichess.** The reference for *calm*. Flat squares, one highlight hue for everything (yellow-green), cburnett pieces, coordinates tucked in corners. It wins on restraint and loses on identity: every board on the internet looks like Lichess now, and the UI around the board is utilitarian. Its feedback vocabulary (arrows, circles) is functional, not designed.
- **Chess.com.** Rich wood textures, glossy pieces, big drop shadows, confetti. Looks "premium" in a 2015 way; the texture fights the pieces, and the highlight yellow was picked for the green board only, so it turns to mud on the wood boards. Aggressive UI chrome around the board.
- **Chessable.** The board is an afterthought (an embedded chessground); the product lives in the text. Nothing to steal visually, but its drill loop (move, instant verdict, spaced repetition) is the interaction model we already chose.
- **ChessBase / Fritz.** Dense, Windows-native, 3D pieces nobody asked for. Coordinates outside the board in a frame is the one classic idea worth remembering.
- **Independent / Dribbble concepts.** Neon-on-black boards, glassmorphism, glowing squares. Striking for 5 seconds, unusable for 40 minutes. They confirm the trap the brief warns about: striking is cheap, *striking and calm* is the job.

The gap nobody fills: a board whose pieces are designed as a system with the UI (same tokens, same edge treatment, same tinting), on a surface that stays quiet for an hour of focused drilling.

## 2. Pieces — the lever

Survey of what Lichess ships, licences from `lila/COPYING.md` (verified today; `shots/piece-set-survey.png` shows the permissive ones side by side):

| Set | Licence | Use in a product? |
|---|---|---|
| cburnett, merida, mono | GPLv2+ | Only if the app is GPL. It effectively is already (Stockfish WASM in the browser, see the Decision Log) — but this closes the door on ever moving the engine server-side to escape GPL. |
| chessnut | Apache 2.0 | Yes. Clean, legible, slightly hand-drawn. Best drop-in. |
| kiwen-suwi, Firi, totoy, papercut | CC BY 4.0 | Yes, with attribution. kiwen-suwi is the only genuinely "flat modern" one and it is crude (queen, knight). |
| fantasy, spatial, celtic | MIT | Yes, but stylised in the wrong direction. |
| rhosgfx | CC0 | Yes, but cartoon. |
| staunty, maestro, fresca, gioco, tatiana, cardinal, dubrovny, icpieces, horsey, california, caliente, anarcandy, cooke, monarchy, minimal-warmth, disguised, xkcd | CC BY-NC-SA | **No.** Non-commercial. These are the pretty ones, which is exactly the problem. |
| letter, pirouetti, pixel | AGPLv3+ | No (viral beyond GPL). |
| alpha, chess7, companion, leipzig, reillycraig, riohacha, shahi | "freeware" / unspecified / custom | No. |

**Recommendation: a custom set, with chessnut as the shipping fallback.**

The prototype includes a first pass, **Monolith**: six pieces composed from primitives (circles, rounded rects, one bezier for the knight) on a 100×100 grid, drawn twice — an outline pass under a fill pass — so the composed shapes read as one silhouette. It is ~60 lines of SVG. What that buys over any imported set:

1. **Theme tinting.** Fill is a two-stop gradient and stroke is a token; every theme sets its own ivory/graphite/ink to match its board. Imported sets are #fff/#000 forever (the prototype post-processes chessnut and cburnett to take the same tokens, which works, but only for fill and stroke — their internal highlights stay baked in).
2. **Same visual grammar as the UI.** Piece corners, base plinth and stroke weight rhyme with the panel's radii and rules.
3. **No licence question, ever.**

Honest assessment of the pass: the knight and pawn are good, the king and rook are fine, the queen's crown and the bishop's mitre are placeholders that need a real drawing pass (an afternoon in Figma, or a commission at roughly €300–800). The direction — geometric, single-weight, no internal shading — is right for the brief.

## 3. Theme system

Every theme is one CSS block that sets the same ~40 tokens. Nothing else in the app knows a theme exists.

```
surfaces   --bg --surface --surface-2 --border --text --text-2 --text-3
board      --sq-light --sq-dark --coord-on-light --coord-on-dark --frame --board-shadow
pieces     --pw1 --pw2 --pws              white: fill top, fill bottom, stroke
           --pb1 --pb2 --pbs --pbh        black: same + highlight for detail lines
           --piece-shadow
feedback   --accent --sel --last --hl-blend    selection and last move share the accent hue
           --dot --dot-on-dark                 legal-move marker, per square colour
           --hint                              arrow
           --check --ok --ok-fill --bad --bad-fill --focus
type       --font-ui --font-display
```

**Light vs dark is not inversion.** Three things change:

- *Blend mode.* Dark themes lay translucent accent fills over the squares (`--hl-blend: normal`). Light themes use `multiply` with a pale tint, because alpha-blending an accent over light wood goes grey. Paper's first pass (cobalt at 22 % over oak) was mud; multiplied straw over the same oak is the ochre every chess book uses.
- *Highlight hue sits next to the board hue.* Straw on oak (Paper), light blue on steel (Porcelain), amber on walnut (Ember), aqua on slate-blue (Abyss). Complementary pairs desaturate each other on overlap. The arrow is the one element allowed a contrasting hue, because it floats above the board rather than tinting it.
- *Shadows.* Dark themes get a large soft board shadow that mostly dissolves into the background; light themes get a tighter shadow tinted in the board's own hue so it never looks like a grey Photoshop drop.

**Contrast targets.** Square light/dark ≥ 1.6:1 (enough to read the grid, low enough that pieces dominate). Every piece silhouette ≥ 3:1 against both squares via its *stroke*, not its fill — that is why white pieces carry a dark stroke and black pieces a near-black one with a lighter detail line. `--text` ≥ 4.5:1, `--text-2` ≥ 3:1. `--ok` and `--bad` are chosen per theme so they stay distinguishable under deuteranopia (green always lighter than red on dark themes, red always more saturated on light ones), and the board flash is never the only signal — the side panel changes state too.

## 4. The themes

Dark:
- **Obsidian** — neutral graphite and warm stone, ice-blue accent; the quietest, the default.
- **Ember** — charcoal, walnut board, brass accent; the "wood" theme without a single texture.
- **Abyss** — deep navy, steel-blue board, aqua accent; cool and precise.
- **Moss** — near-black green, sage board, straw accent; the Lichess memory, desaturated for hours of use.

Light:
- **Paper** — warm off-white, birch and oak, cobalt arrows; a chess-book diagram.
- **Gallery** — cool white, graphite board, indigo accent; museum-minimal.
- **Porcelain** — blue-white, steel-blue board, amber accent.

Full palettes are the seven `[data-theme]` blocks at the top of `prototype.html`; they are the spec.

## 5. Type, icons, motion

- **Type.** Instrument Sans for UI and move lists (tabular figures on); Instrument Serif italic for the opening name only — chess literature is serif, and one italic line is enough personality. No monospace, no caps labels, no eyebrows.
- **Icons.** Almost none. Feedback is colour + square + panel; the piece glyphs *are* the iconography (promotion picker, later the move list). Where an icon is unavoidable: 1.5 px stroke at 16 px, tinted `--text-2`.
- **Motion.** Piece moves 220 ms, `cubic-bezier(.2,.7,.2,1)` (fast out, soft landing). Correct: green fill + ring that *settles into the ordinary last-move colour* over 1.4 s — feedback decays into state instead of stacking on it. Wrong: 320 ms 2.5 % shake, red fill, then dims to a residual tint; the piece returns. Check: static radial glow, no pulse. Nothing loops. `prefers-reduced-motion` removes transitions and animations, not the colours.
- **Do not.** Textures, gloss, confetti, pulsing legal-move dots, glow on selection, a second accent hue on the board, sound-reactive anything.

## 6. Board details

- **Flat squares, no gradient, no grain.** Texture competes with pieces at 80 px. Depth comes from the piece stroke, a 2 px piece shadow, and the board's own shadow.
- **Coordinates** inside the corners, 1.7 % of board width, weight 600, in the *opposite* square's colour — they belong to the board rather than the frame and disappear until you look for them.
- **Edge.** 6 px radius, a 1 px `--frame` hairline (6 % white on dark, 12 % ink on light), one shadow. No bezel, no wood rim.
- **Highlights.** Selection = fill + inset ring (the ring survives when a piece covers most of the fill). Last move = fill only. Capture target = a ring at 92 % of the square, not a dot, so it reads under the piece. Check = radial glow so it reads as "this piece", not "this square".
- **Arrow.** One polygon per arrow (no marker), 9-unit shaft on a 100-unit square, 30×24 head, starts 26 units out from the origin centre so it clears the piece, stops 6 units short of the target centre, 90 % opacity so the square underneath still reads.

## 7. Still weak

Queen and bishop need a real drawing pass. The `--frame` hairline is invisible on Obsidian (intentional; check on a real monitor). The side panel is a layout sketch, not a designed screen. No keyboard focus states on the board yet (the `--focus` token exists). Drag ghost is not in the prototype.
