---
tags: [feature, design, flow, built-partly]
aliases: [Opening dashboard, Dashboard, Human moves, Approaches]
---

# Opening dashboard

**Status: designed 2026-09-16 (Fable 5.1); the shell is built.** `/openings/[id]` is the dashboard; the
playing screen moved to `/openings/[id]/explore` and `/openings/[id]/practice`. The third approach is
[[The Open]], designed there and not built; its opponent — the answer to the owner's "human moves" ask —
is designed below. See [[Exploration Mode]] for what Explore and Practice do, [[Off-book Practice]] for
the older sketch this supersedes, and [[Learning science for opening training]] for the evidence.

> "Drilling how to respond to unexpected moves which might range from blunders to best move. So usually
> when practicing openings with the computer the computer keeps doing the best move, but what I want to do
> is to practice openings against a range of moves which you can encounter when facing off against *human*
> players. … Such a button should belong inside some view which acts like a dashboard for a specific
> opening. … From here you can select how you want to approach the opening in question, and also see
> various interesting information in regards to the opening whatever that might entail."

## What it is for

A learner opens the Ruy Lopez with one question: *what should I do with it now, and where do I stand?*
The dashboard answers with a picture, two numbers and a choice. The picture is the opening's territory —
the line map, lit where they have been. The numbers are the two things that can be true of a learner and
an opening: how much of it they have **found**, and how **ready** they are to play it against a person
(the rating [[The Open]] produces). The choice is the three approaches, each saying in one line what it
would do *for this learner today*, with the one that fits promoted. It does not teach, list variations, or
explain the opening; it is the place you stand before you sit down at the board, and the place you come
back to between games.

## The approaches

Three: Explore, Practice, The Open. Each is *for* something different; a fourth would be a duplicate.

| Approach | For | Opponent | Rated | Exists |
| --- | --- | --- | --- | --- |
| **Explore** | The first encounter. Find the established lines by playing good moves; the map fills in. | Book, steered to unfound lines; dubious theory now and then | Never | Yes |
| **Practice** | Keeping what you found. Replay discovered lines from memory when FSRS says they are about to go. | The line's own moves | No | Yes |
| **The Open** | Playing it. Five rounds from the defining position against opponents with a name, a rating and a repertoire, scouted before each; composure carries; each round moves your readiness rating. | Sampled from human play (below) | Yes | [[The Open]], designed |

**How they rank on the screen.** The dashboard leads with whichever the numbers point at: due lines
first (forgetting cannot wait), then Explore while fog remains, then The Open once the book is found and
nothing is due. The order of the cards is fixed — Explore, Practice, The Open — because it is the order a
learner meets them; the lead card is marked, not moved.

**Considered and not added.**
- *Human moves as its own mode.* The owner's ask was a distribution of opponent moves; a ladder of
  opponents with repertoires *is* that distribution, with a reason to care about it (the scouting
  report) and a number that moves (the rating). One card, not two.
- *Punish* (research P6: ten positions where the opponent has just erred, a third where they have not).
  Its lesson — punish what can be punished, and know when nothing can — is what composure teaches in
  The Open, where failing to punish spends the chance passed up. If a cross-section drill is ever wanted
  it belongs in *Today*, not here.
- *A named-line drill* ("play me the Breyer"). It already exists as *play from here* on a found line in
  the map, and that is where it belongs: you choose a line by pointing at it, not from a list of 146.
- *A straight replay* (watch the line). Showing is not learning; the research's version — preview, then
  reproduce unaided in a later session (P5) — is an on-ramp *inside* Explore for a learner with no
  discoveries in a variation, and *Study* in The Open's preparations is its rated cousin.
- *Play the computer from the opening.* The Open's strongest opponents are this.

## What information belongs on it

The data really there: 146 sound lines and 8 dubious in the Ruy Lopez, named, in 31 variations (13 of
size ≥ 2, 18 single-line ones the map folds into *Sidelines*); a stage per line (entered / discovered)
with a timestamp; FSRS state per discovered line, replayed from the review log; engine candidates, a PV
and `sharpness` for 732 positions; `opponentSharpness` for the opening (the picker's *Lethality*); the
attempt log of Practice decisions with response times. Not yet there: a rating per (learner, opening).

**Shown, and why.**
1. **The map, in Overview, as the hero.** It is the only thing that shows *this* learner's Ruy Lopez —
   how big the Closed is, that they have one edge of it, that the Berlin is untouched. It is the Round 3
   identity piece and it already exists; on the dashboard it is on the page, not behind a button. Detail
   and *play from here* work in it as before. On a phone it stays a sheet, and the spine stands in.
2. **Two headline figures: Readiness and Found.** Readiness is the Glicko-2 rating from The Open,
   shown as a number with nothing else; until The Open exists the slot shows an em dash and "unrated ·
   play The Open" — the absence of a value, in the size the value will have, never an invented one.
   Found is discovered of sound total, with "N entered, unfinished" as its sub-line.
3. **Two states under them, small: Remembered and Due.** Remembered = review-state lines with recall
   ≥ 0.9 of discovered (mastered appended when any); Due = lines due now, or the next return date. These
   are the three line states the research asked the bar to show (P1) and they decide which card leads.
4. **One line of facts in the header:** the side, the defining moves, the line and variation counts, the
   dubious count. Facts about the opening, not the learner; `--text-3`.
5. **Each card's status line**, computed: Explore "143 still secret, 1 entered but not finished";
   Practice "3 lines due now" / "All caught up — the next comes back tomorrow" / "Nothing to replay yet
   — explore first"; The Open "Not built yet…" until it is, then "Rated today · best run 4 of 5" or the
   like.
6. **Where you left off:** the newest discovery's short name and when, one line under the numbers. The
   picker's "continue where you left off" brought inside.

**Not shown, and why.**
- *The by-variation list* with "still secret" 32 times: the map says it better and the critique
  already called it clutter.
- *Per-position sharpness and evaluation*: facts about a position, so they belong beside the board.
- *Lethality dots*: a comparison between openings, so they belong on the picker. On one opening's own
  page a 4-of-5 with nothing to compare against is decoration.
- *Coverage / retention / precision / median response time* from `proficiency()`: they measure the
  retired tree Practice and say nothing about lines.
- *The dubious lines' names*: a band in the map and a count in the header. Listing them would tell a
  learner what to avoid before they have met it — the no-spoiler rule.
- *Tags* ("popular", "aggressive"): picker chips.
- *A rating history or graph*: when The Open exists, one number and its deviation; a sparkline is for a
  later "your openings" overview, where ratings can be compared.

## The layout

The same frame as every playing screen (`--page-max`, the `minmax(0, 1fr) / minmax(--panel-min,
--panel-max)` grid, `--chrome`), so picker → dashboard → board never moves the columns. Where a
playing screen has a board on the left and a panel on the right, the dashboard has **the map on the
left and the choice on the right**.

**Desktop (≥ 861 px).** Left: the map in Overview, in a bordered surface as tall as the frame allows
(`100dvh − --chrome`), its own Overview/Detail switch in its header, no Close. Right, top to bottom:
- the header — side stone + "You play White", the name in the display face, the defining moves, the
  fact line;
- the standing — Readiness and Found as two large display-face figures side by side with a label above
  and a sub-line below; a hairline; Remembered and Due as two small label-and-number pairs;
- "Last found: *Bird Variation, Paulsen Variation* · yesterday" (only when there is one);
- the three cards, stacked: name, status line, button; the lead card carries a thin `--accent` rule on
  its left like a notice and the primary button; The Open's card is muted with a disabled *Enter*. When
  the window is at least 800 px tall each card also shows one sentence about the approach in general;
  at 720 the status line alone says enough and the page fits without the panel scrolling;
- the save-status line, as on the other screens.
Measured: window scroll 0 and panel overflow 0 at 1280×720, 1366×768, 1440×900 and 1920×1080, in
Obsidian, Onyx and Gallery.

**Phone (≤ 860 px).** One column: header, the standing (same two rows), last found, the spine (the shelf
with its count) with a *Map* button, the three cards as compact rows (name and status left, a thumb-sized
button right), the save line. Fits a 390×844 screen with the two-row nav and the footer (measured 0
scroll); the map opens as the bottom sheet it already is.

**Hierarchy.** The map is loudest by area, the two figures by size, the lead card by colour. Nothing
else competes: the header is one weight, the other cards are quiet, the facts are `--text-3`. In
Graphite and Vellum the lead rule is `--accent` like everywhere else; the map keeps its `--signal` for
"in progress".

## Navigation

- `/openings/[id]` is the dashboard. Sessions have their own URLs: `/openings/[id]/explore`,
  `/openings/[id]/practice`, and `/openings/[id]/open` when The Open exists. One route
  `[id]/[mode=session]` with a param matcher (`src/params/session.ts`), so switching mode is a param
  change, not a remount: the engine and the bundle stay.
- The bundle loads once in `[id]/+layout.server.ts`; the dashboard and the sessions share it.
- Picker → dashboard → session. The session's header carries "← Dashboard"; on a phone that header is
  hidden and the mode row has no room for another button (a third one wraps it and the screen scrolls),
  so the link sits in the *Moves & progress* sheet's header beside Close — an installed app has no Back
  of its own, so the phone needs one in the page. The Explore/Practice switch navigates with
  `replaceState`, so toggling modes does not stack history entries. **Browser back** from a session goes
  to the dashboard, from the dashboard to the picker.
- The dashboard's map hands a found line to Explore as `?line=<key>`; Explore starts and resumes from
  the line's end, as *play from here* does on the playing screen.
- **A returning learner lands on the dashboard**, always. Games are not persisted today, so there is no
  session to return to; when a game *is* persisted (step 5 below) the Explore card says "Resume — move
  9, Closed" and the dashboard is still the landing: the choice is the point of the screen and it costs
  one click. A run of The Open in progress is the one exception worth making: a rated run should resume
  where it stopped, so its card says "Round 3 of 5 · resume".
- Keys on the dashboard: `E` Explore, `P` Practice, `M` open the map on a phone.

## The Open's opponent — where human moves come from

[[The Open]] says an opponent is a name, a rating and a repertoire, that the profile needs move
frequencies the bundles do not carry, and that a faked opponent is fine to play but not to scout. This
section is the rest of that design: what can be built from what exists, what tier 1 needs, how the
learner is judged, and what happens to discovery. It replaces the separate human-moves mode the owner
first asked for; the mode's one control (an opponent rating band) disappears, because Swiss pairing by
the learner's rating chooses the opponent.

### Tier 0 — an opponent from engine evaluations, no new data

What is there: 3.7 engine candidates on average per position (multi-PV, 1 to 5) with evaluations, the
book's own continuations, and past the bundle Stockfish in the browser with multi-PV. So a **persona**
can be drawn from the engine's spread: at each opponent move, sample among the position's candidates by
win-chance loss with a temperature, `p ∝ exp(−loss / τ)`, over the bundle's candidates inside it and the
engine's past it; book continuations missing from the candidates join with the evaluation of the
position after them (the session already looks this up for reply soundness). At a rate `r`, when a
candidate with loss in [0.15, 0.5] exists, play it — the planted mistake `chooseReply` already plants.
`(τ, r)` come from the opponent's rating by a table.

**A persona is sampled once, then fixed.** Draw the opponent's favourite reply at each of the first few
branch points from that distribution, seeded by the opponent's name, and let the rest be the
distribution. Then the scouting report can describe *this opponent* truthfully — "plays 3…Nf6 in three
games of four" is a fact about the persona the learner is about to meet, not a claim about people. What
tier 0 cannot say is anything about *rating*: the persona's habits are engine-shaped, not
1650-shaped, so the report must not say "like a 1650 would". Measured on the Ruy Lopez: only 82 of 359
opponent positions have a plantable mistake among their candidates, and a position has 2.3 sound
candidates on average, so the spread is narrow and the blunders are the engine's near-misses. A 1500's
favourite 3…d6 (24 % under 1800) is book, so it appears; the hanging pawn on move 6 that the engine
ranks tenth never does. Good enough to play against; the rating it produces is on the app's own scale
and should be shown without an "Elo" label until tier 1.

### Tier 1 — human shares from the Lichess dump

[[Popularity and explanation data]] measured this: the monthly dump (CC0, 30 GB, ~92 M games) is the
only open, current source; one streaming pass of about an hour with 12 workers gives, for every bundle
position *and one ply past each opponent position*, the share of each reply by rating band (< 1800,
1800–2199, ≥ 2200) — two numbers per reply and one object per node, under 10 % growth on the 575 KB
Sicilian bundle. Personas are then drawn from a band's real distribution; the report's facts come from
the same numbers ("3…a6 four times in five" *is* the ≥ 1800 share of 3…a6 at that position, rounded to
the persona's habit); blunders arrive at the rate people make them; and the fallback to tier 0 happens
two plies off the book, where the game is an engine game anyway. Human replies not already in the bundle
need evaluations: the eval cache covers 99.5 % of catalog positions and popular deviations are exactly
what the Lichess eval DB has, so most are free; the rest need the native-Stockfish fallback
[[Off-book Practice]] already lists. The pipeline needs one download, one new script
(`pipeline/popularity/build.ts`), and a join in `build.ts`. The Lichess explorer API, which
[[The Open]] names, is token-gated and rate-limited to one request at a time (that note's own finding):
the dump is the way.

### How the learner is judged

The opponent's move is often not theory, so "the book move" is not the target. The target is **stay
sound; punish what can be punished**, graded exactly as Explore grades a move past the book: by
win-chance loss against the engine's best, from the bundle inside it and from the engine past it.
Composure spends that loss, so the grading needs nothing new; only the copy changes:
- After a sound human reply (loss < 0.06), any sound learner move passes and the copy says nothing
  special. This is the non-punishable case the research insists on, arriving at its natural rate rather
  than being staged.
- After a mistake (loss ≥ 0.15), the best move is much better than the rest, so a reply that misses the
  punishment grades as an inaccuracy *by the same rule*, and composure spends the chance passed up (the
  session's `opportunity`). Copy: "Missed the punishment", with *Why?* — which already asks the learner
  to play the punishing move themselves.
- Inside the book the learner's move is graded from the bundle without the engine, as today.

### Discovery

Lines the learner reaches in The Open with their own unhinted moves **count as discovered**, entered and
discovered alike. [[The Open]] leans "entered yes, discovered no — you met it, you did not find it";
the disagreement is recorded there and below. A discovery is defined by the learner reaching a line's
end with their own moves; the opponent's policy does not change what the learner did, and two
definitions of "discovered" is the two-truths problem the research warned about. *Study* shows a line,
and a line reached through a shown move already does not count — the existing rule covers the
preparation. What differs from Explore: the opponent does not steer toward unfound lines, so discoveries
are rarer and come from the lines people actually play.

### On [[The Open]] as written — where I think it is wrong or missing

1. **"A round ends when the book is exhausted for both sides, or ply 24."** The book is exhausted the
   moment the opponent leaves it, which a human-shaped opponent does early and often (mean line length
   in the Ruy Lopez is 14 plies; one-move sidelines end at ply 7). Under that rule a round against a
   1500 who plays 4…h6 would end after two learner moves. The round should end at a fixed length —
   ply 24, or eight learner moves past the defining position — whatever the book does; leaving the book
   only changes where the grading comes from (bundle → engine), which the session already handles.
2. **Composure has no scale.** "100 composure, every move spends the win chance it gives away": win
   chance is on [−1, 1], so is 100 composure one whole point, or ten? A club player gives away roughly
   0.05 per move on average; over five rounds of eight moves that is 2.0. The scale should be set so
   that a *clean* round by a player of the persona's rating is the norm, which means it comes from the
   tier 1 band data (mean loss per move by band), not from a round number.
3. **Named characters with invented specifics.** "Has never declined the pawn on e4" is a sentence
   about a person; band frequencies are sentences about a population. The persona sampling above makes
   the report true by construction — say what the sampled repertoire does, never what the character
   "has never" done.
4. **"You get to a winning position" is rightly rejected**, and "leave the opening with your evaluation
   intact" is right; but the opening's *baseline* differs by opening (a Ruy Lopez is +0.3, a King's
   Gambit is −0.3), so the round's target must be *relative to the opening's own evaluation at the
   defining position*, not to 0.00. Composure as cumulative loss already does this; the copy should too.
5. **Discovery**, as above: count it.
6. **The rating's scale before tier 1** must not be called Elo or compared to Lichess; it is readiness
   on the app's scale until opponents are drawn from real bands.

Everything else — composure carrying between rounds, one preparation per round, pairing by rating,
exploration never rated, one rated run per opening per day — holds.

## Deferred: a share button

The owner, 2026-09-16: "Another feature which apps usually have which I suppose we can have is some sort
of *share* button. The dashboard should probably have this in order for users to be able to share their
progress. However, since we're still quite early on I think we should wait with this until we have a more
established setup."

So: **not now.** Noted here so it is not lost. When it comes, the dashboard is the right home for it —
it is the screen that holds the figures worth sharing — and it wants [[The Open]]'s readiness rating to
exist first, because "3 of 146 lines found" is a weaker thing to post than a rating and a streak. The
groundwork that already exists: `Copy` (`src/lib/ui/Copy.svelte`) puts text on the clipboard in one press,
and the playing screen uses it for a position and a game.

## What to build, in order

1. **The dashboard shell** — *built, see below.*
2. **The Open, tier 0.** `src/lib/explore/persona.ts` (the sampler and the persona draw, seeded, with
   the `(τ, r)` table), an `opponent` option on `ExploreSession` that replaces `#bookReply` with the
   persona inside the book too, composure as a derived over the session's losses and opportunities, the
   `open` route with the round loop, scouting report and preparations, Glicko-2 per (learner, opening)
   in a new `ratings` table with the same local-first outbox as reviews. The report speaks only of the
   persona. Tests: with a seeded random a low-rated persona plays a plantable mistake at about `r`, a
   high-rated one almost never; the sampler never plays outside the candidates + book set; a book reply
   stays marked `book`; a persona is stable for its seed; composure is monotone.
3. **Popularity, tier 1.** The dump pass and the join per [[Popularity and explanation data]]; personas
   drawn from band shares; reports gain the band; measured loss per move by band sets composure's scale.
4. **A persisted game and run.** The Explore card becomes "Resume"; a run of The Open resumes at its
   round.
5. **Picker.** Cards show readiness and "N due" alongside found; the resume card names the lead
   approach. Then a "your openings" overview where readiness across openings can be compared.

### File-by-file, step 1 (as built, 2026-09-16)

- `src/routes/openings/[id]/+layout.server.ts` — loads the index entry and the bundle once for the
  dashboard and the sessions (was `+page.server.ts`).
- `src/routes/openings/[id]/+page.svelte` — the dashboard.
- `src/routes/openings/[id]/[mode=session]/+page.svelte` — the playing screen, moved; `mode` from the
  route; the mode switch navigates with `replaceState`; a back link to the dashboard; `?line=` resumes a
  found line.
- `src/params/session.ts` — `explore | practice`; `open` joins it in step 2.
- `src/lib/explore/dashboard.ts` — pure: `standing()` → total / discovered / entered / remembered /
  mastered / due / next due / last found; `promote()` → the lead approach; `statusOf()` → each card's
  line; `ago()`, `dueIn()`, `shortName()`. 8 tests in `dashboard.test.ts`.
- `src/routes/+page.svelte` — unchanged: it already links to `/openings/[id]`, which is now the
  dashboard.

Screenshots: `Design/Round 4/shots/dashboard-*.png` (Obsidian, Onyx, Gallery; desktop 1280×720 and
phone 390×844; fresh and with progress).
