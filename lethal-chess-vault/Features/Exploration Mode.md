---
tags: [feature, flow, built]
aliases: [Exploration Mode, Line Discovery, Explore]
---

# Exploration Mode

**Status: built 2026-09-15; replaces Learn.** Modes on the playing screen are **Explore · Practice · The
Open**, at `/openings/[id]/explore`, `/practice` and `/open`; since 2026-09-16 an opening is entered through
the [[Opening dashboard]] at `/openings/[id]`, which promotes one of them. [[The Open]] is `ExploreSession`
with a human-shaped opponent and a fixed round, so everything on this page about grading, hints and
discovery holds there too.
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
5. **A bad move never stops the game** (changed 2026-09-16, owner: "otherwise how is it possible to know
   *why* it's a mistake?"). The move stands, the computer answers it, and the notice names it with
   *Why?* (what it allowed, from the engine's line) and *Take back* beside it. The one exception is a
   **missed punishment**: when the computer has just erred and the learner walks past it, the move is
   rewound once and the chance is named — a second miss plays on.
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
- **Nothing else gives the move away.** An inaccuracy, a dubious book move and a blunder all say what the
  move *was* and point at Hint; none of them names what to play instead. The answer costs two deliberate
  presses, and that is the only way to it. The opening's own defining moves are the exception — they are
  fixed, so the notice names them.
- **Take back** returns to the previous decision, never into the defining moves.
- **The line card** sits above the notice (under the board on phones).
  - **Anticipation:** from a line's entrance until its end, the card shows "Line in progress", the
    entrance name, progress pips for the nearest unfound end, and how many lines are left to find from
    here.
  - **Celebration:** when the end is reached, by either side's move, the card celebrates "Line
    discovered". A one-move line is celebrated at once.
  - **Repeats and hints:** completing a known line again shows "Line completed again", which is not
    recorded. A line reached through a shown move gets "End of the line — with a hint".
  - **Duration:** a celebration stays until the user's next move has been answered.
  - **History:** v1 floated a toast over the board; it covered pieces and reappeared forever. v2 announced
    entries once and discoveries separately. The user asked for anticipation → celebration instead
    (2026-09-16).
- **Past the book it is an analysis board (2026-09-16).** Once the game leaves the established lines:
  - the evaluation bar appears — and only then, since inside the book it would give the lines away;
  - ← and → step back and forward, a move in the list can be clicked to jump there, and *Play from here*
    (Enter) carries on from the position on the board, dropping what came after it;
  - stepping back into the book hides the evaluation again.
- **No evaluation shown** (bar or number) on the opening page while learning, at the user's request
  (2026-09-16). Evaluation belongs in a future analysis mode. "How exact you must be" stays.
- **Page stats.**
  - Discovered / total, plus the number entered but not finished, on a split bar.
  - By variation: discovered names, entered lines (…), and how many are still secret.
  - Dubious lines listed apart.

## Practice: line review (built 2026-09-16)

Practice replays **discovered lines from memory**, following [[Learning science for opening training]]
(P1: discovery without revisiting is forgetting with a celebration).
- **What gets reviewed.** Discovered, sound lines with at least one learner move past the defining moves,
  most overdue first, then lines never replayed, oldest discovery first. When nothing is due the page
  says "All caught up", with *Replay a line anyway* and *Explore*.
- **The walk.** It starts at a random point between the defining moves and the line's entrance, with the
  name hidden and progress pips only. The computer plays the other side's moves of the line.
- **Grading.** A sound move from another line is "good too, but this line goes another way": try again,
  rated Hard. A wrong move gets one unhinted retry, then the move is shown, rated Again. A piece hint is
  Hard, the arrow Again. The line is rated by its worst decision.
- **Schedule.** FSRS per line, *derived by replaying the review log* (`lineCards`). The log is the D1
  table `line_reviews` (migration 0003) plus localStorage and the outbox, like discoveries. Attempts are
  still recorded per decision (mode `practice`).
- **Panel.** Remembered / discovered (Review state and recall ≥ 0.9), mastered (also stability ≥ 21
  days), due now or the next review date.
- **Replaced:** the old engine-best single-move tree Practice (`DrillSession`) is no longer used by the
  page. The research called this "two truths". Its code and the bundles' practice trees remain, to be
  pruned.

## Today (built 2026-09-16)

`/today` (nav link) is a finite daily session: the due lines of *every* opening with discoveries,
interleaved round-robin across openings. Within an opening the most overdue line comes first, then lines
never replayed. The session is capped at 10 lines (research P3 + P4-lite).
- **During:** each line is a `ReviewSession`. The opening is shown, the line's name is hidden until the
  end, and a session strip colours each result.
- **End:** "That's today done" with the count remembered. There are no streaks or points, by design: the
  research found contingent rewards undermine intrinsic motivation.
- **Loading:** bundles are fetched only for openings with discoveries.

## "Why?" as a question (2026-09-16)

After a stopped mistake, *Why?* asks the learner to **play the opponent's punishing reply** (one retry),
then plays the engine's line out for up to 5 plies and takes it back, leaving the arrow and PV text.
Research P2 (errorful learning with the correction generated by the learner).

**Corrected 2026-09-16** (from [[2026-09-16 — Correctness audit]] #14): this note used to say that after a
*missed* punishment *Why?* shows the missed move and counts it as shown. It does not, and never did — the
rewind path records no mistake, so *Why?* is not offered at all; on a second miss it explains the
refutation of the learner's own move and marks nothing as shown. Nothing book-side is given away either
way, so the behaviour is sound and it was the note that was wrong.

*Why?* is also dropped if the engine answers after the learner has moved on: an explanation of a position
they have left would be worse than none, and it used to block *Why?* for the mistake they were on.

### What may be named (2026-09-16)

One rule, in `displayName` in `linemap.ts`, after the rule was broken four times in a day in four
different places: **a discovered line may be called by its name, a line only entered is called after its
entrance, a band's root after its band, and anything else has no name at all.** The tooltip, the end's
`aria-label` and the phone's confirm dialog all read that; nothing outside `linemap.ts` reads `.name` off
a line. Being *on* a line is not entering it, so `here` requires the position to be past that line's
entrance, the layout offers an end only from what the stages record, and `resume` clamps to what has been
earned however it is asked — a hand-written `?line=` included. Three layers on purpose.

## The map (built 2026-09-16)

The chart from [[README|Round 3]], as `LineMap.svelte` over the pure layout in `src/lib/explore/linemap.ts`.
"Open the map" (`M`) in the panel, or a click on a shelf segment, opens it: a wide overlay on desktop, a
bottom sheet in Overview on phones. Built only while open; rebuilt wholesale on each discovery.

- **Bands.** One per variation, largest first; single-line variations fold into *Sidelines*; dubious lines
  sit in their own band at the bottom, as the page lists them apart. A click on the band name collapses it.
- **States.** Discovered lines are lit (`--ok`) end to end, with their name at the end in Detail. Entered
  lines are warm (`--accent`): solid up to the entrance — and as far as the game has come on the line being
  followed — dashed beyond, with a hollow end and *no* name: the end is still secret. Everything else is
  fog: dotted `--text-3` structure, hollow ends, no names or moves. The moves (SAN, converted once per line)
  are written only on lit and solid-warm edges, at the landing end of each edge.
- **Where you are.** A warm dot with one slow ring on the node the game has reached, on the line being
  followed or else any line through the position; still under `prefers-reduced-motion`. The band's name
  turns warm too.
- **Budget.** The Sicilian in Detail is ~1,870 SVG elements, built in a few ms (test: ≤ 2,000 and ≤ 30 ms).
- Monochrome themes (Graphite, Vellum) use `--signal` for "in progress", since their `--ok` and `--accent`
  are both white.

Screenshots: `Design/Round 3/shots/impl-map-*.png`.

## Persistence

- Progress is stored as discoveries in [[Progress Tracking]]: `{ bundleId, line, stage, at }`.
- They are kept in localStorage, and for signed-in users also in the D1 `discoveries` table (migration
  `0002_discoveries.sql`), through the same outbox and import endpoint as attempts.
- The first time a stage is reached is kept; re-sends are no-ops. Included in export and delete.

## Open / next

- ~~**Practice over discovered lines.**~~ Built 2026-09-16; see "Practice: line review" below.
- **Lines ending on the computer's move** (e.g. "Retreat Variation" 3...Nb8) are discovered by the
  computer's choice. Should the learner also have to answer them well?
- **Thin openings.** London (2 lines), Danish and Budapest (6 each) have little to explore.
- **Picker.** The opening picker could show discovered/total per opening.
- **Design round 3 (2026-09-16).** Prototypes for making discovery *feel* like exploration — a fog-of-war
  line map with a shelf under the board, a one-second on-board celebration with trail markers for
  anticipation, and picker cards as a collection: [[README|Round 3 README]], [[Critique]].
