---
tags: [design, review, fable, exploration]
aliases: [Round 3 critique, Explore page critique]
---

# Round 3 — critique of the Explore page and the picker

Fable 5.1, 2026-09-16, for [[Exploration Mode]] and [[Visual Design]]. Screenshots in `shots/` were taken
from the dev server at 1400×1000 and 390×844 in Obsidian, Alabaster, Amethyst and Graphite; the file names
say which (`explore-<theme>-<desktop|phone>-<state>.png`, `picker-<theme>-<size>.png`). The prototypes
that answer this critique are described in [[README|the Round 3 README]].

## The short version

The page is well made and calm, and it is the drill page with a statistics footer. Nothing on it says
"exploration". The board, where the eye lives, never reacts to a discovery; the discovery counter — the
mode's whole point — is the last thing in the sidebar, under a 5-pixel bar. The picker has just learned to
show a count per opening, but it still reads as a catalogue of nearly identical thumbnails.

## Explore page, desktop

![[explore-obsidian-desktop-progress.png]]

**Hierarchy.** The right column is a stack of six equal-weight blocks — header, mode switch, line card,
notice, "How exact you must be", moves, discoveries — separated by four hairlines. Every block has the same
type size, the same left edge and the same weight, so nothing is first. The one number that should be
first (`0 / 146`) is at the bottom, after the move list, and its progress bar is a hairline. The user
scans top-to-bottom and reaches the reason for the mode last.

**The moment happens off-stage.** A discovery is announced in the sidebar (`explore-alabaster-desktop-celebrate.png`)
while the board stays exactly as it was. The line card is good copy — "Line discovered", the name in the
display face — but it appears 700 px to the right of where the last move was played, and it *inserts*
itself above the notice, pushing the notice, its buttons and everything under them down by 90 px. Every
celebration is also a layout shift; the buttons the user is about to click move.

**Redundancy.** After a discovery the line's name is on screen twice: in the header's `.variation` line
("Ruy Lopez: Morphy Defense, Alapin's Defense Deferred") and in the card. In the celebrate shot the notice
under the card says "Your move — past the known lines" while its body says "An established move." — the
title and the text contradict each other, because the title is derived from the *current* position and the
text from the *last* move.

**The tracked all-caps eyebrow.** `LINE DISCOVERED` / `LINE IN PROGRESS` with 0.12 em tracking is the one
templated typographic device on the page. The rest of the app uses sentence case, and the display face
already carries the emphasis.

**Clutter that fights "not distracting".**
- The "By variation" list expanded (`explore-obsidian-desktop-panel.png`): 31 rows, each with a name,
  `0/N`, and "N still secret" — the phrase "still secret" 32 times. An entered line shows its full name with
  the family prefix ("Ruy Lopez: Fianchetto Defense …") while discovered lines drop it; inconsistent.
- "How exact you must be — Relaxed" with a five-segment meter sits between the notice and the moves. It is
  a fact about the position, not about exploration, and it is styled like a KPI.
- The "Saved in this browser. Sign in to keep it everywhere." line is in the panel on every visit.
- Three buttons (Hint, Take back, New game) sit inside the notice even when the notice is celebrating.

**What is boring.** The page has no shape of its own: a board, a column. A learner who has found 12 lines
and one who has found 120 see the same screen apart from a number. There is no picture of the territory —
what is found, what is entered, how much fog is left — and so no reason to come back to *this* opening
rather than another.

**Board.** No complaints. The hint arrow, last-move tint and the wrong-move flash are clear in all four
themes. The board is the best thing on the page and it is used only as an input device.

## Explore page, phone

![[explore-obsidian-phone-celebrate.png]]

- The order is board → line card → notice → mode switch → hint text → *page title* → sharpness → moves →
  discoveries. The name of the opening arrives after a mode switch, and the mode switch's helper sentence
  ("The lines are secret. Play good moves to discover them.") is the third paragraph of body text the user
  reads before knowing where they are.
- The top bar is two rows (brand + Sign in, then the nav): 165 px of 844 before the board.
- During a celebration two toned cards stack (`Line discovered` in green, `Evaluating…` in grey with a
  New-game button): two voices at once.
- The discoveries block is a screen and a half down (`explore-obsidian-phone-bottom.png`). The "1 / 146"
  number is the only reward for the discovery, and it is below the fold.
- The move list is a three-column grid at full phone width; the two move columns are 150 px apart with
  nothing between them.

## Picker, desktop and phone

![[picker-obsidian-desktop.png]]

- **Every thumbnail is the start position ± three moves**, so 28 mini boards are visual noise: they don't
  distinguish openings at a glance. They are the product's identity and should stay, but they can't carry
  the card alone.
- **Lethality in red.** Four of five bars in `--bad` red for the Ruy Lopez, the Italian, the King's Gambit.
  On a browsing page red reads as an error state. The meter fights the calm the drill page keeps.
- **Hierarchy jumps.** "You play White" is a 1.7 rem serif; the group heading under it ("1.e4") is 0.85 rem
  grey text; then a wall of identical cards. There is no middle level.
- **The new per-opening count** (`picker-amethyst-desktop.png`, "2/146 lines" with a hairline bar) is the
  right information in the weakest possible form: 0.68 rem, `--text-3`, at the bottom right of the card,
  under chips that say "popular" and "aggressive" — generic tags that rank above the learner's own progress.
- The hero's three numbered steps repeat the paragraph above them almost word for word.
- Phone: six lines of body text, then the numbered steps, then the featured board, before the first card.

## What to keep

- The token system and the four board styles: everything below is built from `--accent`, `--ok`, `--text-3`
  and the theme's own fonts and needs no new theme work.
- The line card's *copy* and two stages (anticipation → celebration).
- The board's restraint. The prototypes add to the board only in the second after a move, and only for a
  second.
