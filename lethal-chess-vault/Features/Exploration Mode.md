---
tags: [feature, flow, built]
aliases: [Exploration Mode, Line Discovery, Explore]
---

# Exploration Mode

**Status: built 2026-09-15; replaces Learn.** Modes on the opening page are now **Explore · Practice**.
Code: `src/lib/explore/` and `buildLines` in `pipeline/repertoire/build.ts`. See [[System Map]].

> "Instead of expecting the user to follow fixed lines we could design the app around exploration. All
> lines are secret, but we show an 'x out of n lines discovered' statistic somewhere appropriate. When the
> user discovers a move which leads to an established line we celebrate, and we keep playing whenever the
> user makes good moves instead of interrupting the flow."

## The flow (agreed with the user, 2026-09-15)

1. **The defining moves are given.** The page lists them (e.g. Ruy Lopez 1.e4 e5 2.Nf3 Nc6 3.Bb5). Every
   game starts from the initial position, and a different move there is refused with an arrow to the
   right one.
2. **After them, the user explores.** Established lines are secret. The user may always play any good
   move; the system only reports what happens.
3. **Two stages.** A line is *entered* at its entrance and *discovered* only when its end is reached.
   The page shows both.
4. **"Follow the line."** Inside an entered line the notice asks how it continues, and Hint is there to
   help.
5. **A bad move gets a choice.** A mistake or blunder off the book stops play with *Try again* / *Play on*.
   So does missing a punishable move after the computer erred. Good moves never interrupt.
6. **Purpose: active learning.** No arrows by default; the user has to think.
7. **Dubious lines are shown separately.** A dubious line needs a learner move the coach calls a mistake.

## Definitions

- **Line.** A catalog line with no catalogued continuation: its end is where theory stops.
  | Opening | Lines |
  | --- | --- |
  | Ruy Lopez | 154 |
  | Sicilian | 259 |
  | English | 134 |
  | Caro-Kann | 73 |
  | London | 2 |
- **Entrance.** The deepest *named* position before the end, past the defining moves. For example,
  "Closed, Breyer Defense, Zaitsev Hybrid" is entered at "Closed, Breyer Defense". A line with no such
  position (a one-move sideline) is entered and discovered at once.
  - *Rejected alternative:* use each name's own entries. About 185 of the Ruy Lopez's 200 names have a
    single entry, so entrance and end would almost always coincide.
  - *Rejected alternative:* use the first move unique to the line. For about 60% of lines that move is
    the last one.
- **Key.** The EPD of the line's end, so transpositions count whatever the move order.
- **Dubious.** Following the line takes a learner move losing ≥ 0.2 win chance (the coach's "mistake").
  The Ruy Lopez has 8; the King's Gambit has 14 of 126.

## Behaviour

- **Grading.** Inside the book, moves are graded from the bundle's evals without the engine. Past the
  book the engine loads on first need. A finished game is scored from its result, because Stockfish sends
  no lines on a mated position.
- **Computer replies in book.** Each reply is weighted by √(undiscovered lines + 0.2 × discovered lines)
  × soundness (1, 0.5 or 0.15 by the reply's win-chance loss). Big families don't drown out small ones,
  and dubious theory appears now and then as something to punish.
- **Leaving the book with a good move.** Play continues; the message says it left the established lines.
- **Hints.** First the piece, then the arrow, for the book move that keeps the most unfound lines open.
  A line through a position where the move was *shown* does not count as discovered; the user is told
  to find it alone.
- **Take back** returns to the previous decision, never into the defining moves.
- **Announcements.** A card above the notice (under the board on phones) says "New line entered" or "Line
  discovered". It stays until the user's next move has been answered. Each entrance name is announced
  once per game.
  - v1 floated the card over the board: it covered pieces and, through a timer/effect loop, reappeared
    forever. User feedback 2026-09-15; fixed.
- **Page stats.**
  - Discovered / total, plus the number entered but not finished, on a split bar.
  - By variation: discovered names, entered lines (…), and how many are still secret.
  - Dubious lines listed apart.

## Persistence

- Progress is stored as discoveries in [[Progress Tracking]]: `{ bundleId, line, stage, at }`.
- They are kept in localStorage, and for signed-in users also in the D1 `discoveries` table (migration
  `0002_discoveries.sql`), through the same outbox and import endpoint as attempts.
- The first time a stage is reached is kept; re-sends are no-ops. Included in export and delete.

## Open / next

- **Practice over discovered lines.** Spaced repetition of what the learner has found (planned line
  mastery). Practice still drills the single-move repertoire tree.
- **Lines ending on the computer's move** (e.g. "Retreat Variation" 3...Nb8) are discovered by the
  computer's choice. Should the learner also have to answer them well?
- **Thin openings.** London (2 lines), Danish and Budapest (6 each) have little to explore.
- **Picker.** The opening picker could show discovered/total per opening.
