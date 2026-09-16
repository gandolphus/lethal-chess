---
tags: [audit, correctness, explore, sync, fable]
aliases: [Correctness audit]
---

# 2026-09-16 — Correctness audit

Correctness half of the owner's "rigorous correctness and security audit"; security is a separate note.
Audited `main` at b2da9a4 (the Prism merge) against what the vault says the app does: [[System Map]],
[[Decision Log]], [[Exploration Mode]], [[The Open]], [[Progress Tracking]]. Follows
[[2026-09-16 — Exploration audit]] (all seven fixes re-checked, still hold) and
[[2026-09-15 — Fable soundness audit]]. `pnpm test` 444 green + 16 expected failures, `pnpm check` 0 errors.

**Fixed the same night, at the owner's word: 1–10, 12 and 13.** Their tests are plain `it` now and guard
the fixes. Two `it.fails` remain, both deliberate: #11, which is a fact about the shipped catalogue rather
than a code defect, and the companion to #6 that prints the three dubious book positions. #14 was the
vault being wrong, and the vault has been corrected. See the status column.

Evidence: every confirmed finding has a failing vitest test, committed as `it.fails` so the suite stays
green; each turns into a plain `it` when its defect is fixed. The audit files are
`src/lib/explore/audit-spoilers.test.ts` (6), `src/lib/explore/audit-session.test.ts` (2),
`src/lib/drill/audit-progress.test.ts` (3), `src/lib/explore/audit-review.test.ts` (2),
`src/lib/coach/audit-coach.test.ts` (2) and `pipeline/repertoire/audit-data.test.ts` (1 failing, 2 guards
that pass). Four Fable 5.1 agents did the work: one on the spoiler rule and the session, three on chess
correctness, progress accounting and the shipped data.

| # | Sev | Status | Finding |
|---|---|---|---|
| 1 | medium | **fixed** `f594241` | The map names lines that are only *entered*: on every warm bead's tooltip, in the end's `aria-label`, and in the phone's tap-to-confirm dialog — which also names the bundle's first line at every band root |
| 2 | medium | **fixed** `f594241` | The map treats the line the game merely *sits on* as entered: right after the defining moves it offers the bundle's first line's end, and picking it replays moves never seen and records the line as entered |
| 3 | medium | **fixed** `f1c88f9` | The outbox's "send the rest" is dead code: a backlog over 500 rows and the rows behind a dropped one wait for the next write; "Saving…" never clears |
| 4 | medium | **fixed** `f1c88f9` | An unnamed 4xx on a batch with rows in two lists is re-sent identically forever — the soundness audit's fix #2 does not cover it |
| 5 | low | **fixed** `f594241` | A move played during a map replay's trace races the trace: the move tree gets a move the board refused |
| 6 | low | **fixed** `3f4e23f` | Practice calls a dubious line's losing move "good too" and rates it Hard; 3 shipped positions, up to 0.30 win chance |
| 7 | low | **fixed** `3f4e23f` | A move that ends the game by repetition or the fifty-move rule is graded from the pre-move analysis, so throwing a win away is "best" |
| 8 | low | **fixed** `3f4e23f` | The Open's celebration card fires on the opponent's theory move, saying what the round is meant to keep quiet |
| 9 | low | **fixed** `3f4e23f` | A finished round is reopened by ← → to the tip; the next move is tallied as a ninth decision |
| 10 | low | **fixed** `3f4e23f` | *Why?* answered after the learner has moved on lands on the new position, and blocks *Why?* for a new mistake |
| 11 | low | open | 61 line ends are continued by catalogued theory by position; leaf-ness is decided by UCI prefix |
| 12 | info | **fixed** `f594241` | The Explore URL trusts `?ply=`: any line's full route can be replayed and credited by hand — `resume` now clamps to what the stages record, whoever asks |
| 13 | info | **fixed** `3f4e23f` | `winChance({ mate: 0 })` is level — refused at `parseInfo` instead, since the sign cannot survive the flip by side to move |
| 14 | info | **vault corrected** | The vault says *Why?* after a missed punishment shows the missed move and counts it as shown; the code shows the refutation of the learner's move and marks nothing |

---

## 1 · The map names entered lines

**medium · CONFIRMED** · `src/lib/explore/linemap.ts:299-303`, `src/lib/ui/LineMap.svelte:77,168,293-295,329,336`

[[Exploration Mode]] (The map): "Entered lines are warm … with a hollow end and *no* name: the end is still
secret." The SVG honours that; the text around it does not.

- **Tooltip.** `layout` gives every lit or warm bead a `line` — the first line through it that is
  discovered, entered *or "here"* — and `name: known?.name`. `LineMap.svelte` renders `peek.name` under
  the diagram. Hover any bead of an entered line's solid part and the tooltip reads the *end's* name,
  e.g. "Ruy Lopez: Closed, Breyer Defense, Zaitsev Hybrid" while the learner has only reached the Breyer.
- **Button label.** Each pickable end is `role="button"` with
  `aria-label="Pick up {node.line.name} where you left off"`. A screen reader announces the secret name.
- **Tap dialog.** On a touch pointer a pick asks first: `Play from <strong>{asks}</strong>?` with
  `asks = `${asked.line.name} — ${san[resumeTo - 1]}``. The move is the entrance's (correct); the name is
  the end's (not). Same at every **band root**: its bead carries `line: band.lines[0]` so a click can
  replay the opening, and the dialog names that line — in the Ruy Lopez, "Alapin Defense, Alapin Gambit"
  for anyone who taps the Closed band's root. This is the "first node names an undiscovered line" leak
  fixed earlier today, still alive in the dialog.

Phones are where the owner tests, so the dialog is the one people will see.

**Tests.** `audit-spoilers.test.ts` › "does not name an entered line on the tooltip of its warm beads",
"does not hand the page a name for an entered line's end", "carries the bundle's first line, which the
tap-to-confirm dialog names".

**Fix.** Give `LayoutMove` and `LayoutNode` a display `name` that is the line's name only when
discovered, the *entrance* name (`entryName ?? variation`) when entered, the band's name at a root; have
the label, the dialog and the tooltip read that, never `line.name`.

## 2 · "Here" counts as entered

**medium · CONFIRMED** · `src/routes/openings/[id]/[mode=session]/+page.svelte:414-418`,
`src/lib/explore/linemap.ts:121,135-137,309-325`, `src/lib/explore/session.svelte.ts:536-572`

The page's `here` is the line being followed, "else any line through the position": `at[0]`. Right after
the defining moves every line runs through the position, so `here = { line: lines[0], index: 5 }` — a
line whose entrance has not been reached. `layout` then treats `isHere` like `entered` at the line's
end: the node's stage is `'entered'`, its `line` is set, `resumeTo = entranceOf(line)`, and the end is a
warm, clickable ring labelled "Pick up … where you left off". In the Ruy Lopez that is the **Alapin
Gambit** (entry 6), so after 3.Bb5 the map offers it; a click calls `resume(line, 6)`, which traces and
plays 3…Bb4 — a move the learner has never seen — and `#visit()` records `entered` for it (and for the
Alapin Defense's other lines through that position). Two things the rule forbids at once: an unearned
move on the board and unearned credit in the store.

The same fallback marks that line's band as "here" and its edges up to `here.index` warm with move
labels; before any entrance that is only the root, so the visible symptom is the end.

**Tests.** `audit-spoilers.test.ts` › "a line the game is merely on, before its entrance, gets no
clickable end" (layout), "picking up the line the map calls 'here' credits an entrance the learner never
reached" (layout → `resume` → two `entered` records).

**Fix.** In the page, `here` should fall back to a line only when `index >= line.entry` (what
`following` already requires) — or, in `layout`, make an end pickable only when its stage is really
`entered`/`discovered`, and clamp `resumeTo` to `Math.min(entrance, here.index)` for a here-only line.
`resume()` itself could refuse `upTo` beyond `max(entry if entered, length if discovered)` from
`stages`, which also closes #12.

## 3 · The outbox's continuation never runs

**medium · CONFIRMED** · `src/lib/drill/synced-store.ts:133,154,169`

`flush()` shares one upload: `#flushing ??= #upload().finally(() => (#flushing = null))`. After a
confirmed batch with rows left, and after a rejected row is dropped, `#upload` calls
`queueMicrotask(() => flush())`. That microtask runs *before* the `.finally` reaction (which is queued
when `#upload`'s promise resolves, i.e. after), so it joins the upload that just finished and starts
nothing. Consequences: a backlog over 500 rows moves one batch per write or page load; after a rejected
row is dropped the rows behind it wait for the next write; `onStatus('synced')` is never reached on that
path, so the page keeps "Saving…". The existing `synced-store.test.ts` cases at lines 173 and 192 pass
only because they call `store.flush()` in a loop themselves.

**Tests.** `audit-progress.test.ts` › "sends a backlog larger than one batch without being poked", "goes
on with the rows behind a rejected one without being poked".

**Fix.** Chain the follow-up on the flush itself: `.finally(() => { #flushing = null; if
(pendingCount()) void flush(); })`, or use `setTimeout(…, 0)` instead of a microtask.

## 4 · An unnamed 4xx with two lists poisons the outbox

**medium · CONFIRMED** · `src/lib/drill/synced-store.ts:191-208`

When the server's error names no row, `#reject` halves `#limit` until the batch is a single row
(`outboxSize(batch) === 1`), then drops it. `#limit` is one cap over four lists: with one attempt and
one discovery the batch is two rows at limit 1, the halving bottoms out at `max(1, floor(1/2)) = 1`,
nothing is dropped, nothing backs off, and every later flush re-sends the identical batch. A 403/404
from the edge (a WAF challenge, a bot rule) on an outbox left by an offline session is enough. Today it
shows as a stuck outbox; once #3 is fixed it becomes a tight request loop.

**Test.** `audit-progress.test.ts` › "drops or backs off instead of re-sending the same batch forever".

**Fix.** When halving cannot shrink the batch (no list longer than 1), drop the batch or treat the
error as transient with backoff; or halve per list.

## 5 · A move during a replay's trace races it

**low · CONFIRMED** · `src/lib/explore/session.svelte.ts:536-572,746-751`

`resume()` resets the board and walks the route but the last move, then awaits the trace (220 ms a
move) with `phase` untouched — still `your-move` from the game before, so `canMove` is true and the
board is interactive. Past the defining moves `#before` is null and `submit` refuses every move
silently: a live board that does nothing. *Inside* them, the move goes through: the map's band-root
bead is exactly that case (`resume(lines[0], opening.length)` — the Ruy Lopez shows four plies and
leaves White to move). The learner plays 3.Bb5 during the trace, the computer's reply is queued; the
trace ends, finds its last move illegal, breaks, and queues a second reply for the same position. The
second `Game.move` returns null — but `#played` records it anyway, so the tree reads 1.e4 e5 e5 with
`current` on the phantom, and a click on it makes `#goTo` throw from `game.load`.

**Test.** `audit-spoilers.test.ts` › "a move during the trace does not race the replay".

**Fix.** Set `phase = 'thinking'` at the top of `resume()`; and in `#computerMove`, skip `#played` when
`game.move` returns null (a general guard worth having).

## 6 · Practice grades a dubious book move as sound

**low · CONFIRMED** · `src/lib/explore/review.svelte.ts:185-193`

`#isSound` returns true for any `isBookMove` before the loss check. Explore says of the same move "An
established move, but a dubious one"; Practice says "`d4` is good too, but this line goes another way"
and rates the line Hard. Shipped: 3 learner positions where another book move loses ≥ 0.2 (Vienna
Frankenstein-Dracula ply 10 `d4` → Adams' Gambit, 0.25; King's Gambit Declined Panteldakis ply 6 `Nf3`,
0.30; Alekhine Hunt/Matsukevich ply 5 `Nf4`, 0.24), 29 where it loses ≥ 0.1, 69 above the 0.06 bar a
non-book move is held to.

**Tests.** `audit-review.test.ts` › "does not call the dubious line's losing move 'good too'", "has none"
(prints the three positions).

**Fix.** Apply the node loss check to book moves too, falling back to "book = sound" only where the
node is missing.

## 7 · A drawing move is graded from before it

**low · CONFIRMED** · `src/lib/coach/freeplay.svelte.ts:174-177`, `src/lib/explore/session.svelte.ts:835-844`

Both `#scoreAfter` and `#scoreOfMove` look the played move up in the pre-move multi-PV first and only
then ask `scoreOfEnded`. Stockfish sees a FEN, not a history, so a move that repeats for the third time
or hits the fifty-move rule carries the winning score in the multi-PV; the learner who throws a won
position away by repetition is told "Best move" and the bar keeps the win. Checkmate is unaffected.

**Test.** `audit-coach.test.ts` › "scores a threefold repetition from the pre-move analysis, so throwing
away a win is 'best'".

**Fix.** Check `scoreOfEnded` before the `known` lookup in both places.

## 8 · The Open's celebration says the opponent played theory

**low · CONFIRMED by reading** · `src/routes/openings/[id]/[mode=session]/+page.svelte:332-340,539-562`

`anticipation` is guarded by `!explore.round` with the comment "in a round the line card would say the
opponent just played theory, which is the thing to work out"; `celebration` is not. 54 % of lines end on
the computer's move, so mid-round the card says "Line discovered — Ruy Lopez: Berlin Defense", and the
board traces the route: the opponent's last move was theory, hence sound — the very fact `#pending`
(`session.svelte.ts:283`) withholds from the move list. No test: it is page markup; the one-line guard
is the fix.

## 9 · A finished round reopens from the tip

**low · CONFIRMED** · `src/lib/explore/session.svelte.ts:493-529,596-610`

`#endRound` sets `over` and `canTakeBack` is off for rounds, but `canBack` is on in `over`. ← enters
browse; → back to the tip is `node === #live`, which hands play back through `#continue`: the computer
answers the eighth move and the ninth is tallied ("Round over — x of 9 precise").

**Test.** `audit-session.test.ts` › "cannot be played on from the tip".

**Fix.** In `#goTo`, when `node === #live` and the round is over, stay `over`; or keep `canBack` off
once a round has ended.

## 10 · A late *Why?* lands on the wrong position

**low · CONFIRMED** · `src/lib/explore/session.svelte.ts:475-491`

`explain()` captures the generation, but `submit` never bumps it. Press *Why?* on a blunder, play on
while the engine thinks, and the explanation arrives for the position two moves back; `canExplain` is
then false for the new mistake because `explanation` is set.

**Test.** `audit-session.test.ts` › "an explanation that arrives after the learner has moved on is
dropped".

**Fix.** After the await, require `this.#mistake === fen` before setting `explanation`.

## 11 · Line ends continued by theory

**low · CONFIRMED** · `pipeline/repertoire/build.ts:261-262`

"A line is a catalog line with no catalogued continuation." `buildLines` decides that by UCI-string
prefix; 61 of 1,777 ends are continued by 124 catalog lines by *position*. 41 are the interior ends the
previous audit's #8 counted (the owner left them); the other ~20 are continued by lines outside the
opening's root (Ruy Lopez "Open, Classical Defense, Main Line" → `e8g8`, Scotch "Lolli" → `d7d6`,
Smith-Morra "Scheveningen Formation" → `e1g1`). Effect is the known one: celebrated mid-line, "Line
completed again" on every later pass.

**Test.** `audit-data.test.ts` › "every line ends where the catalogued theory stops, by position" (lists
all 61).

**Fix.** Define leaves by position, or write the transposed-end rule into [[Exploration Mode]].

## 12 · `?ply=` is trusted

**info · CONFIRMED by reading** · `src/routes/openings/[id]/[mode=session]/+page.svelte:191-204`

`begin()` passes the URL's `ply` straight to `resume`, which clamps it to the line's length and
records whatever it lands on. `/openings/ruy-lopez/explore?line=<end EPD>&ply=40` replays and credits
any line; the bundle with every key is a public static file. Only a learner cheating themself, but the
check belongs in `resume()` (see #2's fix).

## 13 · `mate 0`

**info · latent** · `src/lib/coach/judge.ts:14`

`Math.sign(0)` makes `winChance({ mate: 0 })` 0.5. Stockfish emits `score mate 0` without a PV, which
`parseInfo` drops, and no shipped bundle carries it. Test: `audit-coach.test.ts` › "treats mate 0 as
decided, not level".

## 14 · *Why?* after a missed punishment

**info · spec gap** · `src/lib/explore/session.svelte.ts:400-408,475-491`

[[Exploration Mode]] "'Why?' as a question": "when the learner missed a punishable computer mistake,
*Why?* shows the missed move instead, which counts as a shown move." The rewind path sets no `#mistake`,
so *Why?* is not offered; on the second miss it shows the refutation of the learner's move, and nothing
is added to `#shown`. No spoiler results, since nothing book-side is shown; the note is wrong.

---

## Suspected

- **Catalog move order along "here".** `edgeState` and the labels write `here.line.moves` up to
  `here.index` as played (`linemap.ts:135-137,290-293`). A learner who transposed in by another order sees
  the catalog's moves, not their own. The previous audit counted 98 transposing (position, move) pairs;
  which of them differ in move *set* rather than order was not checked.
- **Two sessions after a double N.** `startExplore` awaits `loadDiscoveries` before assigning `explore`,
  so a second press abandons the *previous* session and leaves the first new one alive. It sits in
  `your-move` with no board bound to it and never records; harmless, but a leak of the class #1 in the
  exploration audit closed.
- **Picker counts are local only** (`src/routes/+page.svelte:45`): a signed-in learner on a fresh
  device sees 0 found until each opening has been opened once. Documented as deliberate in the code.
- **Every never-reviewed discovered line is "due"** (`mastery.ts:45`), so one discovery promotes
  Practice on the dashboard. Consistent with "then lines never replayed"; reads as overdue.

## Verified fine

- **The spoiler rule elsewhere.** No notice names the better move outside the defining moves and the
  round's end; the eval bar is gated on `!inBook` and hidden through a round; `evaluation` is nulled when
  browsing into the book; The Open hides the opponent's mark until answered, the variation name, the
  anticipation card and the sharpness meter; the shelf and the by-variation list show variation names
  and totals, as the spec says; `Board`, `EvalBar` and the Today strip carry no secret in a label; the
  hint's `#shown` survives take-back and resume (conservative); a hinted line is shown but not credited;
  Practice hides the name until `done` and reveals only the expected move on the reveal path.
- **Session.** `submit` sets `thinking` synchronously, so a double click cannot play twice; `abandon`
  on N, mode switch and unmount; every `await` in `start`, `takeBack`, `#goTo`, `playFromHere` and the
  engine paths is generation-checked; take-back after mate is one ply or two as the turn requires; the
  round's first decision per ply survives take-back and retry.
- **Chess.** Bundle candidates are best-first for the mover in all 12,591 multi-candidate nodes;
  `parseInfo`'s sign flip, bound lines, dedupe; threefold, fifty-move and insufficient material reach
  `draw` and survive `load(uciHistory)`; promotion and underpromotion through `find`/`move`, castling
  rights on undo; `scoreOfEnded` signs; `lossFor`/`verdictFor` symmetric and clamped; `chooseReply` and
  the human flavours never empty; `movedPieces` handles castling, en passant, promotion and same-type
  captures; a stale promotion picker cannot submit onto a new position.
- **Progress.** Stores and outboxes are namespaced per user, so a second account on one device sends
  and sees nothing of the first; sign-out keeps the outbox after a confirm; two tabs draining share a
  synchronous read-modify-write and the server import is idempotent (primary keys, all-or-nothing
  batch); the merge unions by key and cannot lose a newer local row; `stagesOf` never downgrades;
  `lineCards` replays in `at` order and a future-stamped review neither throws nor breaks `mastery`; a
  `ReviewSession` records once, at the end, and a revealed move can never count as remembered; Today's
  cap and round-robin hold.
- **Data.** Keys unique across 1,777 lines (guard test added); no line is a position-prefix of another;
  every named position between an entrance and its end carries only the opening's own name; `dubious`
  never flips between transposing routes; every PV starts with `candidates[0]` and every move is legal;
  the catalog has no duplicate EPD; the vault's line table matches. 163 lines share their `entryName`
  with their own name because the catalog repeats a name along a main line — the card names the line at
  its entrance, which the entrance earns.

## Suggested order

1 and 2 together (one display name on the layout, `here` only past an entrance, `resume` refuses more
than the stages earn — which closes 12) → 3 and 4 (the outbox; fix 4 first or 3 turns it into a loop) →
8 (one guard) → 5 → 9 → 10 → 6 → 7 → 11 (a decision, not a fix) → 14 (rewrite the note). Update
[[Exploration Mode]] "The map" for what the tooltip and the dialog may say, and log the outbox rule in
[[Decision Log]].
