---
tags: [audit, explore]
aliases: [Exploration audit]
---

# 2026-09-16 — Exploration audit

Read-only audit of [[Exploration Mode]] on `main` (23fd386): `src/lib/explore/{book,session.svelte}.ts`,
`src/routes/openings/[id]/+page.svelte`, `buildLines` in `pipeline/repertoire/build.ts`, and the
discovery path through [[Progress Tracking]] (local store, outbox, D1, export/delete). Follows
[[2026-09-15 — Fable soundness audit]] (all nine fixes re-checked, still hold). `pnpm test` (all files)
and `pnpm check` (0 errors) pass.

Evidence: a Monte Carlo harness driving the real `ExploreSession` over **all 28 shipped bundles**
(4,200 games, 238,748 plies, seeded, fake engine with plausible scores; scratch file
`src/lib/explore/audit-mc.test.ts` in the audit worktree), ten targeted vitest repros (R1–R10,
`src/lib/explore/audit-repro.test.ts`), three data scripts over the bundles' `lines`, and two headless
Chromium runs against the dev server (which serves a newer working tree than 23fd386 — it already has
"Why? W" and "Try again T" — so the browser was used only to confirm the mobile order and the B key in
"decide", both consistent with the audited source). Scripts and logs:
`~/.claude/jobs/eb2370b5/tmp/explore-audit/`.

| # | Sev | Status | Finding |
|---|---|---|---|
| 1 | medium | CONFIRMED | "New game" while the computer thinks leaves the old session alive: it finishes its move, records discoveries, runs the engine, and the new session celebrates the same line again as new |
| 2 | medium | CONFIRMED | Take back after a discovery keeps "Line discovered" on the card (the page's `ply` test goes negative), hiding the anticipation card |
| 3 | low | CONFIRMED | B (take back) in the "decide" phase behaves like Try again but also forgets the pending opportunity; the next miss passes silently |
| 4 | low | CONFIRMED | An off-book move that transposes onto a line is told "It leaves the established lines" while the card says "Line in progress" and the line is recorded as entered (98 such moves in the bundles) |
| 5 | low | CONFIRMED | 21 learner-to-move book positions have no node, so the engine loads mid-book and grades from its own search; 19 computer-to-move ones weigh replies blind |
| 6 | low | PLAUSIBLE | An analysis with no lines on a position that is not over strands the session: phase `thinking` with no pending work, or `your-move` with every move refused |
| 7 | low | CONFIRMED | The hint ranks by open lines before soundness: in 14 positions the arrow points at a move the notice then calls "a dubious one" |
| 8 | info | data | 41 line ends sit inside another line by transposition (celebrated mid-line); 54 % of lines end on the computer's move |

---

## 1 · "New game" during thinking: the abandoned session keeps playing and recording

**medium · CONFIRMED (repro R3)** · `src/routes/openings/[id]/+page.svelte:86-101,252,393`,
`src/lib/explore/session.svelte.ts:204-213,369-415`

`startExplore` builds a *new* `ExploreSession` from a fresh `loadDiscoveries` snapshot and drops the
reference to the old one; nothing invalidates the old session's generation. The N key and the
"New game" button are live in every phase, including `thinking`. If the learner presses N during the
computer's 450 ms delay or a 700 ms engine search, the old session:

- resumes after its `await`, plays the computer's reply, runs `#visit()` and **records** the lines that
  reply enters or completes (`onDiscovery` → `store.recordDiscovery` → `refreshStats`),
- then calls `#prepareLearnerTurn` → `#analyse` on the shared `Engine` (serial lock), so the new game's
  first analysis waits behind a search nobody will read.

The new session's `stages` were read *before* the old one recorded, so when the learner reaches the same
line end again it is celebrated as `known: false` ("Line discovered") and `onDiscovery` fires a second
time; only the store's dedupe stops a duplicate row.

**Repro R3.** Fixture, computer's reply held in `wait`; `submit(g1,f3)` pending; page-style
`startExplore` builds session 2 from the store; release → session 1 has `e4 e5 Nf3 Nf6`, all three
records come from session 1, engine called; session 2 then plays `Nf3` and gets
`{ kind: 'discovered', known: false }` for Petrov, records again; the store holds one row.

**Fix.** Give `ExploreSession` an `abandon()` that bumps `#generation` (every `await` already checks
it) and call it from `startExplore`, `startPractice` and the `onMount` cleanup; or keep `start()` on
the same instance and reload `stages` into it. Either way build the new `stages` *after* the old
session is dead.

## 2 · Take back keeps the celebration on the card

**medium · CONFIRMED (repro R1; 197 occurrences in the simulation, once per ~37 take-backs)** ·
`src/routes/openings/[id]/+page.svelte:238-242`, `src/lib/explore/session.svelte.ts:300-306`

`celebration` shows the latest `discovered` event while `history.length - latest.ply <= 2`. After
`takeBack()` the history is *shorter* than `latest.ply`, the difference is negative, the test stays
true, and the card keeps saying "Line discovered — <name>" for a line whose end is no longer on the
board. `anticipation` is `null` whenever `celebration` is set, so the "Line in progress" pips (which
`progress` computes correctly) are hidden until the learner has made two more moves. `takeBack` does
not touch `events`.

**Repro R1.** Fixture: `e4 … Nf3 Nc6 Bb5 a6` (Spanish discovered at ply 6) → `takeBack()` → history
length 4, `progress = { played: 1, total: 3 }`, page formula still returns the ply-6 event.

**Fix.** `history.length >= latest.ply && history.length - latest.ply <= 2`, or have `takeBack`
drop events with `ply > history.length` (they are re-created if the end is reached again — `known`
this time, which is right).

## 3 · B during "decide" silently forgets the opportunity

**low · CONFIRMED (repro R2; browser: B in "decide" undoes the move and shows the plain "Your move"
notice)** · `src/lib/explore/session.svelte.ts:295-306,324-332`, `src/routes/openings/[id]/+page.svelte:254,380-392`

In `decide` the notice offers Try again / Play on, but `canTakeBack` is true and the B key calls
`takeBack()`: one ply is undone (same position as Try again) and `#reset()` clears `opportunity`,
`hintLevel`, `#hintMove` and the message. Try again keeps `opportunity`, so a second miss of the
punishment stops again with "You missed an opportunity"; after B the same inaccuracy passes with
"Slightly inaccurate". Two exits from the same state with different rules, one of them undocumented.

**Repro R2.** Computer plants `…f6` (loss 0.18, `opportunity = { san: 'f6' }`); learner plays `a3`
(loss 0.125) → `decide`. `tryAgain()` → `opportunity` kept. `takeBack()` → same history, `opportunity`
null, `a3` again → `your-move`, no stop.

**Fix.** In `takeBack`, when `phase === 'decide'`, delegate to `tryAgain()`; or exclude `decide` from
`canTakeBack` (the buttons already do).

## 4 · Transposition into a line: "leaves the established lines" vs "Line in progress"

**low · CONFIRMED (repro R10 on the Dutch bundle; 98 (position, move) pairs across 2,167 learner
book positions — Sicilian 27, Ruy Lopez 7, Queen's Gambit 6, QGD 5)** ·
`src/lib/explore/session.svelte.ts:243-244,267,484`, `src/lib/explore/book.ts:64-66`

`book` is `isBookMove(epd, uci)` — a move-keyed test — while `#visit()`, `following` and `progress`
are position-keyed. A move that is not a continuation *here* but lands on a line position (the
catalog's other move order) gets `book = false, wasInBook = true`: the notice says
"Best move. It leaves the established lines, though.", the card says "Line in progress", and the line
is recorded `entered`. The move is also graded as off-book, so a transposition into a *dubious* line's
mistake move stops for "Try again / Play on" instead of "An established move, but a dubious one".

**Repro R10.** Dutch, learner Black, `1.d4 f5 2.g3 g6 3.Bg2`: `…Nf6` is not a continuation, lands on
"Leningrad, Warsaw" at index 6/14 ≥ entry → message "Best move. It leaves the established lines,
though.", `progress.name = 'Dutch Defense: Semi-Leningrad Variation'`, two `entered` records.

**Fix.** Decide `book` from the position reached: `this.#book.at(afterEpd).some(({ line, index }) =>
index >= line.entry)` (or `index > 0`), and `leaving = wasInBook && !inBookAfter`.

## 5 · Engine needed inside the book

**low · CONFIRMED (data; 9 engine calls in 32,289 simulated in-book learner turns)** ·
`pipeline/repertoire/build.ts:267-287` (`nodeAt` returns `undefined` on a missing eval),
`src/lib/explore/session.svelte.ts:354-364,383-385,422-433`

`stats.missingBookEvals` is 103 over the shipped bundles. 40 positions on lines have continuations but
no node: **21 with the learner to move** — `#prepareLearnerTurn` finds no candidates, shows
"Loading the engine…" and grades the book move from a 700 ms search — and 19 with the computer to move,
where `#bookReply`'s `soundness` is 0.5 for every option (dubious replies as likely as sound ones) and
`chanceBefore` stays `null`, so the reply can never be an opportunity. Examples (R6 output):
Italian "Giuoco Piano, Krause" after 18/20/22 plies, "Therkatz-Herzog" after 26, QGD "Semi-Tarrasch,
Kmoch" after 19, "Orthodox, Classical" after 25/27, Ruy Lopez "Marshall Attack, Re3" after 24/26,
Sicilian "Alapin, Barmen, Endgame" after 17, Scotch "Gottschall" after 22, Slav "Meran, Rellstab"
after 25/27. The vault says "positions inside the book never need it".

**Fix.** Evaluate those 103 positions into the cache and rebuild (the list is a one-liner over
`book.lines` × `bundle.nodes`), and make `build.test.ts` assert `missingBookEvals === 0` for shipped
bundles; or document the exception.

## 6 · An analysis with no lines strands the session

**low · PLAUSIBLE (mechanism CONFIRMED by repros R4/R5; trigger needs a search that reports no PV on a
live position)** · `src/lib/explore/session.svelte.ts:387-392,360-366,240-241,467-471`

- Computer's turn: `if (!analysis.lines.length) { this.#checkOver(); return; }` — when the game is not
  over, nothing sets the phase: `thinking` forever, `canTakeBack` false, only New game helps (R4). The
  learner's preceding move was also graded `best` because `#scoreOfMove` fell back to the best line's
  score.
- Learner's turn: `#before = { lines: [] }` → `submit` returns `null` for every move, `hint()` finds
  nothing; the board is interactive but dead (R5).

Stockfish 18 sends no PV only on mate/stalemate (handled by `#checkOver`), so on the opening page this
needs a hiccup (a `stop`, a worker restart, a future time-based cut). With 1 % empty analyses injected
the harness hit 273 stuck-thinking states in 840 games. `FreePlay.#computerMove` has the same shape.

**Fix.** In `#computerMove`, if no lines and not over: play any legal move (or the book move) rather
than return; in `#prepareLearnerTurn`, if no lines: retry once, then set `#before` to a synthetic
best-of-legal so `submit` still works.

## 7 · The hint can point at a move the notice then calls dubious

**low · CONFIRMED (data; 14 of 2,167 positions, all lines undiscovered)** ·
`src/lib/explore/session.svelte.ts:553-563`

`#suggest` sorts continuations by open-line count, with soundness only as a tie-break, and only drops
continuations whose *every* line is dubious. Where a continuation with more open lines loses 0.10–0.20
win chance to the best move, following the arrow yields "An established move, but a dubious one —
X was better." Examples: King's Gambit `2…f6 3.fxe5` (loses 0.13 vs `Nc3`), `…Bg7 O-O` (0.14 vs
`h4`), English `2…c5 3.Nf3` (0.11 vs `d5`), QGD `…f6` (0.13 vs `Be7`), Alekhine `…c6` (0.10 vs `Nxd5`).

**Fix.** Filter continuations by `loss < 0.1` (node candidates are available for all but the 21
positions in #5) before ranking; fall back to the unfiltered list.

## 8 · Data observations (no bug)

- **41 line ends are interior positions of another line** by transposition (e.g. "Catalan Opening:
  Closed" ⊂ "…Closed, Spassky Gambit"; "King's Indian: Four Pawns Attack" ⊂ "Six Pawns Attack";
  Queen's Gambit has 9). Following the longer line celebrates the shorter one mid-line, and every later
  pass shows "Line completed again" (1,957 `known` events in the simulation, most of them these). 37
  line ends are also the entrance of another line, so "Line discovered" and "Line in progress" fire at
  the same position (the card shows the celebration, as designed).
- **959 of 1,777 lines (54 %) end on the computer's move**; Benko 19/19, Danish 6/6, Smith-Morra
  20/22, Ruy Lopez 89/154. The open question in [[Exploration Mode]] is the majority case.
- 226 of 2,167 hint moves are not among the node's candidates (scored from the next node; none needs
  the engine).

---

## Verified fine

- **Simulation** (4,200 games, 238,748 plies, 207,778 learner turns, 24,460 hints, 7,220 take-backs,
  48,912 decide phases, 3,279 new games started mid-think, 866 game-overs): no exception, no unhandled
  rejection, no phase left `thinking`, no `your-move` with the computer to move (book replies always
  legal), no refused move outside the opening, no take-back into the defining moves, no illegal hint
  (arrow move always legal; piece mark always has a legal move), no discovery recorded twice, no
  `entered` after `discovered`, no record off the line or before its entrance, no `discovered` away
  from the end, no event for a line of another bundle, no line end reached without a record (unless a
  move on it was shown), `progress.played ≤ total` always, wrong opening moves always refused with the
  arrow (15 % of opening turns).
- **Generation token**: `start()` and `takeBack()` during `#wait`, `#analyse` in `submit`,
  `#computerMove` and `#prepareLearnerTurn` never wrote stale `phase`/`#before`; the one stale write
  (`#after` in `#scoreOfMove`) is guarded by FEN equality before use.
- **Bundle data**: all 1,777 lines legal; `entry ≤ length` and past the opening for all; every
  entrance has `entryName`; no entrance name equals the root's catalog name or the bundle name; keys
  unique; every line prefixed by `openingMoves`; no repeated position inside a line; `dubious`
  recomputed from the bundle's evals matches all 1,777 flags (14 partly uncheckable where a node is
  missing); all keys pass the server's EPD validator.
- **Discovery sync** (repro R9 + trace): signed-out rows adopt into the account once — two tabs adopting
  at the same time leave a deduplicated local copy, clear the anonymous copy, and drain the outbox; the
  server's `PRIMARY KEY (user_id, bundle_id, line, stage)` + `ON CONFLICT DO NOTHING` makes re-sends
  no-ops (api.test covers it); `#merge` unions by `bundle|line|stage`; `#reject` names
  `discoveries[i]`; export includes and delete clears `discoveries`; sign-out removes
  `lethal:user:<id>:discoveries:*`; `stagesOf` is order- and duplicate-tolerant; `refreshStats` and
  the session read the same store, so the tally matches the events.
- **Grading in the book** never touched the engine except at the 21 no-node positions (#5);
  `#scoreOfMove` scores book moves outside the candidates from the next node (6,933 learner book moves,
  0 need the engine when the node exists).
- **Page**: keyboard `h`/`b` guarded by phase/`canTakeBack`; `Hint` hidden in the opening and disabled
  at level 2; mobile order is card → notice → modes → header (verified headless at 390 px), as designed.

## Simulation statistics

| Opening | Discovered / entered / lines (150 games) | Stale celebrations | Engine calls in book |
|---|---|---|---|
| Sicilian | 65 / 101 / 259 | 7 | 1 |
| English | 57 / 117 / 134 | 3 | 0 |
| Ruy Lopez | 52 / 90 / 154 | 6 | 0 |
| Queen's Gambit | 48 / 115 / 194 | 2 | 4 |
| King's Gambit | 43 / 82 / 126 | 13 | 0 |
| Italian Game | 42 / 80 / 109 | 8 | 0 |
| QGD | 38 / 59 / 74 | 12 | 4 |
| Nimzo-Indian | 36 / 47 / 54 | 8 | 0 |
| French | 33 / 68 / 129 | 10 | 0 |
| King's Indian | 32 / 42 / 48 | 10 | 0 |
| Scotch | 31 / 35 / 38 | 12 | 0 |
| Caro-Kann | 29 / 38 / 73 | 10 | 0 |
| Dutch | 28 / 30 / 43 | 12 | 0 |
| Slav | 26 / 38 / 60 | 3 | 0 |
| Grünfeld | 25 / 26 / 32 | 3 | 0 |
| Scandinavian | 24 / 28 / 32 | 9 | 0 |
| Vienna | 23 / 31 / 34 | 5 | 0 |
| Alekhine | 22 / 35 / 36 | 5 | 0 |
| Evans Gambit | 21 / 26 / 30 | 6 | 0 |
| Smith-Morra | 19 / 18 / 22 | 4 | 0 |
| Benko | 16 / 12 / 19 | 3 | 0 |
| Pirc | 16 / 11 / 16 | 7 | 0 |
| Catalan | 15 / 18 / 19 | 4 | 0 |
| Sicilian Dragon | 12 / 14 / 18 | 4 | 0 |
| Réti | 10 / 9 / 10 | 6 | 0 |
| Budapest | 6 / 6 / 6 | 8 | 0 |
| Danish | 6 / 4 / 6 | 7 | 0 |
| London | 2 / 2 / 2 | 10 | 0 |

- Games 4,200 (150 per bundle, capped at 60 plies); plies 238,748; learner turns 207,778 of which
  32,289 inside the book; engine calls 324,637, of which 9 at positions with book continuations
  (0.03 % of in-book turns) and 1,933 at line positions (mostly line ends, where the book is over).
- Discoveries recorded: 777 discovered, 1,182 entered (of 1,777 lines); 214 assisted completions,
  1,957 repeat completions.
- Stuck states: 0 (`thinking` with nothing pending 0, dead `your-move` 0, wrong turn 0). With 1 %
  empty analyses injected (840 more games, 39,997 plies): 273 stuck `thinking`, dead `your-move` in
  the remaining empty cases (#6).
- Learner behaviour mix per turn: 8 % hint twice then arrow, 5 % hint once, ~57 % random book move
  (when one exists), 4 % take back, 1.5 % new game mid-think, rest random legal move; in `decide`:
  50 % Try again, 40 % Play on, 10 % B; 30 % take back after game over. Fake engine: legal moves,
  15 % of them big blunders (hence 48,912 decide phases), mate scored as mate.

## Suggested order

1 (abandon the old session) → 2 (one-line predicate) → 3 (`takeBack` in `decide` → `tryAgain`) → 4
(position-keyed `book`) → 7 (filter hints by loss) → 5 (fill the 103 missing book evals, add the
assertion) → 6 (defensive fallbacks, also in `FreePlay`). Update [[Exploration Mode]] "Behaviour" for
the transposition rule and #8's numbers, and log the decisions in [[Decision Log]].

## Resolution (2026-09-16)

Fixed the same night, on top of the line map merge:
1. **Abandoned sessions.** `ExploreSession.abandon()` / `ReviewSession.abandon()` bump the generation (or
   set a flag); the page calls them before starting anything new and on unmount, so an old session cannot
   move, record or celebrate.
2. **Celebration after a take back** now needs the history to be at or past the event's ply.
3. **Take back in "decide"** is Try again, so the missed opportunity survives.
4. **A move that transposes onto a line** counts as book: the test is position-keyed after the move.
5. **Missing book evals** — not fixed: filling them needs an eval-cache pass. The engine still loads for
   those 21 learner positions. Noted in [[Exploration Mode]].
6. **An analysis with no lines on a live position** ends the game with "The engine had no move for this
   position", instead of leaving the session waiting.
7. **Hints** rank sound moves before unfound lines, so the arrow can't point at a move the coach then
   calls dubious.
8. **Transposed line ends and lines ending on the computer's move** are left as they are; the second is an
   open question for the owner (see the daily log).
