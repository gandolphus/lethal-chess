---
tags: [research, learning, product]
aliases: [Learning science, Opening pedagogy research]
---

# Learning science for opening training

Research note, 2026-09-16. Question from the owner: *how do we make learning opening theory a lot more
engaging and effective?* Grounded in the learning-science literature, in what competing tools do and
where they fail, and in what this app can already compute. Feeds [[Exploration Mode]],
[[Progress Tracking]], [[Opening Drills]], [[Off-book Practice]] and [[Coached Free Play]]. Data
constraints are in [[Data sources]]; the "precision first, no LLM-originated chess content" rules are in
[[Decision Log]] (2026-09-15).

---

## 1. TL;DR — the five insights that matter most here

1. **Discovery without revisiting is forgetting with a celebration.** [[Exploration Mode]] is a
   strong *first encounter* (generation, no arrows, immediate correction) but a discovered line is
   never asked for again, and "discovered" is counted forever. Retrieval practice is the single largest
   effect in the literature (g ≈ 0.5–0.6), and *successive relearning* — recall it, then recall it again
   in later spaced sessions — has effect sizes of 1.5–4 versus one-session learning. The planned
   **line mastery via FSRS** is not a nice-to-have; it is the mechanism that turns Explore into learning.
2. **Errors teach only when the correction is processed — and the best correction in chess is to play
   the refutation yourself.** Errorful learning beats errorless learning when corrective feedback follows
   promptly and is elaborated; high-confidence errors are corrected *best* (hypercorrection). Today a
   mistake gets an arrow at most. The engine PVs the app already ships are the "why": show the punishing
   line and make the learner play it from the other side.
3. **A novice cannot generate what they have no basis to generate.** The Sicilian has 259 secret leaf
   lines. Trial-and-error over a wide branching factor is guessing, not retrieval; the pretesting effect
   only holds when the answer arrives right after the failed attempt. The expertise-reversal literature
   says novices learn from worked examples first, then fade to problem solving. Keep discovery, but give
   novices a *preview-then-reproduce* on-ramp, and make the collection mechanic point at lines that
   matter, not at catalog leaves.
4. **Openings are positions, not sequences.** Chess expertise is recognition of positions/templates
   with attached plans (Chase & Simon; Gobet). Players specialised in an opening perform a full standard
   deviation better on *its* positions. Masters do hold ~100k memorised opening moves, but organised by
   templates. So: drill positions from random mid-line starts with the name hidden (already in the
   [[Opening Drills]] "known" definition — keep it), interleave *confusable* positions so the learner
   learns what distinguishes them, and attach a computed plan (from the PV) to every line end.
5. **Motivate with information, not with rewards.** Curiosity is an information-gap emotion and peaks at
   *moderate* gaps ("3 left in the Najdorf", not "231 secret lines"). Progress counts are fine as
   *informational* feedback; expected, contingent rewards (streaks, XP, badges) measurably undermine
   intrinsic motivation and push toward shallow reps — the very thing Chessable users complain about. A
   finite **daily session with a clear "done"** is the engagement shape that fits a serious tool.

---

## 2. Evidence digest

Each entry: the finding · strength of evidence · what it implies for Lethal Chess.

### 2.1 Retrieval practice (the testing effect)

- **Finding.** Recalling beats re-studying. Meta-analyses: Rowland 2014 g = 0.50, Adesope et al. 2017
  g = 0.61 ([summary](https://www.sciencedirect.com/science/article/pii/S0959475225001434),
  [Adesope 2017](https://journals.sagepub.com/doi/abs/10.3102/0034654316689306)). The effect is larger
  with *feedback*, with more effortful retrieval, and for more complex material (Rowland). Roediger &
  Karpicke 2006: one week later, restudy 40% vs retrieval 61%
  ([paper](http://psychnet.wustl.edu/memory/wp-content/uploads/2018/04/Roediger-Karpicke-2006_PPS.pdf)).
- **Strength.** Very strong; hundreds of studies, classroom and lab.
- **Implication.** Every learner move in Explore and Practice is already a retrieval attempt — good.
  What is missing is *repeated* retrieval of the same lines over days (2.2). Never replace retrieval with
  showing: the arrow-led Learn mode was rightly killed.

### 2.2 Spacing, expanding intervals, successive relearning

- **Finding.** Spaced beats massed; the optimal gap grows with the retention interval (Cepeda et al.
  2006, [meta-analysis](https://augmentingcognition.com/assets/Cepeda2006.pdf)). Expanding vs uniform
  intervals: Cepeda's meta-analysis leans expanding but with high variance; Karpicke & Roediger 2007
  found the opposite ([JML](https://learninglab.psych.purdue.edu/downloads/2007/2007_Karpicke_Roediger_JML.pdf)).
  *Successive relearning* (recall to criterion, then relearn in ≥ 3 spaced sessions) vs one-session
  learning: effect sizes **1.52–4.19**; a month later scores ~40% higher; relearning takes < 2 min per
  item and shrinks each session (Rawson & Dunlosky,
  [2022 review](https://journals.sagepub.com/doi/10.1177/09637214221100484)). FSRS predicts recall with
  ~4% MAE vs ~14% for SM-2 and needs 20–30% fewer reviews for the same retention
  ([benchmark summary](https://chessatlas.net/blog/spaced-repetition-training/fsrs-vs-sm-2-for-chess-why-the-modern-algorithm-wins-for-opening-retention)).
- **Strength.** Very strong. Exact schedule shape matters less than *that* there is spaced re-testing.
- **Implication.** ts-fsrs is the right choice; the schedule shape debate is settled enough. The gap is
  that **discovered lines are not scheduled at all**. Apply FSRS to lines (and their decisions), target
  ~90% desired retention, and define "mastered" by stability, as [[Progress Tracking]] already proposes.

### 2.3 Interleaving vs blocking

- **Finding.** Brunmair & Richter 2019 (59 studies): overall g = 0.42, large for visual/category
  material, small and mixed for maths procedures
  ([PDF](https://www.psychologie.uni-wuerzburg.de/fileadmin/06020400/2019/Brunmair_Richter_in_press__2019_META-ANALYSIS_OF_INTERLEAVED_LEARNING.pdf)).
  Firth et al. 2021: the mechanism is *discriminative contrast* — interleaving helps when items are
  similar and confusable and are seen close together; interleaving long blocks (minutes per topic) is
  not supported ([review](https://bera-journals.onlinelibrary.wiley.com/doi/full/10.1002/rev3.3266)).
- **Strength.** Moderate–strong, with a clear boundary condition.
- **Implication.** Chess positions are visual category material — the good case. Interleave at the
  *position* level, not "ten minutes Sicilian then ten minutes Caro-Kann". The highest-value interleave
  is between **confusable positions with different correct moves** (transposition twins, "with/without
  …a6", same structure one tempo apart). Block only during a first encounter.

### 2.4 Desirable difficulties

- **Finding.** Conditions that slow performance during learning (spacing, interleaving, generation,
  testing, reduced feedback) improve long-term retention and transfer; learners misjudge this because
  they grade themselves on fluency (Bjork & Bjork 2011,
  [PDF](https://www.waddesdonschool.com/wp-content/uploads/2021/02/Desriable-Difficulties-in-theory-and-practice-Bjork-Bjork-2020.pdf)).
- **Strength.** Strong as a framework; each difficulty has its own evidence base.
- **Implication.** "Good moves never interrupt", hints that cost, no eval bar — all correctly hard.
  Add: random mid-line starts, name hidden, and confusable-pair interleaving. Show learners the *long-term*
  metric (retention of lines) so they don't optimise fluency.

### 2.5 Generation, errorful learning, pretesting — when errors help and when they hurt

- **Finding.** Trying and failing before instruction improves later recall even for items the learner
  got wrong (pretesting effect: Richland, Kornell & Kao 2009,
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/19751074/); Kornell, Hays & Bjork 2009,
  [PDF](https://web.williams.edu/Psychology/Faculty/Kornell/Publications/Kornell.Hays.Bjork.2009.pdf)).
  Metcalfe 2017 (*Learning from Errors*, Annual Review): errors help **when corrective feedback follows
  and is processed**; the higher the learner's confidence in the wrong answer, the *more* they learn from
  the correction (hypercorrection); learning increases further when the correction carries explanation,
  not just the answer; high-confidence errors can return if the correction is later forgotten
  ([PDF](https://www.columbia.edu/cu/psychology/metcalfe/PDFs/Learning%20from%20errorsAnnual%20ReviewMetcalfe2016.pdf)).
  Errors hurt when there is no feedback, when the learner never notices they were wrong, or when the
  "answer" is one guess among many with no cue to generate from.
- **Strength.** Strong for the pretesting/hypercorrection effects; the boundary conditions are well
  replicated.
- **Implication.** Explore's mistakes-stop-play is right. Two fixes: (a) the correction must carry the
  *why* (the refutation), and (b) a fast, confident wrong move deserves *more* corrective treatment, not
  the same — response time in the attempt log is a free confidence proxy. Guessing among 5 unexplored
  book moves is not generation; that is the scaffolding problem in 2.7.

### 2.6 Self-explanation and elaborative interrogation

- **Finding.** Prompting learners to explain "why" while studying or solving: g = 0.55 across 64 reports
  (Bisra et al. 2018, [EPR](https://link.springer.com/article/10.1007/s10648-018-9434-x)). Effects hold
  for problem solving and worked examples. Nate Solon's account of forgetting Chessable lines because
  "the moves were tied together by hidden ideas" he never asked about is the chess case in miniature
  ([Zwischenzug](https://www.zwischenzug.gg/p/memorizing-without-understanding)).
- **Strength.** Strong. Caveat: prompts must be answerable; open "why?" boxes with no check are weak.
- **Implication.** The app cannot write prose explanations (no LLM-originated content), but it can pose
  *verifiable* explanation questions from computed facts: "what does 6.Bg5 attack / prepare / prevent?"
  with options derived from the board and the PV. That is elaborative interrogation with a ground truth.

### 2.7 Worked examples, expertise reversal, the assistance dilemma

- **Finding.** Novices learn more from studying worked examples than from unguided problem solving;
  as knowledge grows the effect reverses and guidance becomes redundant or harmful (Kalyuga, Sweller;
  [overview](https://en.wikipedia.org/wiki/Expertise_reversal_effect)). Koedinger & Aleven 2007: both
  too much and too little assistance hurt; the optimum depends on the learner and should be reached by
  *withholding first, adding on demand* — yes/no feedback, then hints, then examples
  ([EPR](https://link.springer.com/article/10.1007/s10648-007-9049-0)). Jennings & Muldner 2020:
  assistance that *fades in* (start with less-similar examples, add similarity as problems are solved)
  beat assistance that fades out, because near-identical examples get copied
  ([Instr. Sci.](https://link.springer.com/article/10.1007/s11251-020-09520-7)).
- **Strength.** Strong for the reversal; the fade-in result is a single well-designed study.
- **Implication.** Explore's "hint costs the discovery" is the correct *withhold-first* default. But a
  total novice facing 3...a6 / 3...Nf6 / 3...d6 / 3...Bc5 has no schema to reason from; for them the first
  pass through a variation should be a **worked example they predict move by move** (prediction is still
  generation), then reproduced unaided later. Don't copy Chessable's arrow-first default; don't leave
  novices in pure search either.

### 2.8 Chunking, templates, and what opening knowledge actually is

- **Finding.** Chase & Simon 1973: skill differences in recalling positions vanish for random
  positions — expertise is stored *patterns* (chunks), not raw memory. Gobet & Simon 1996 extended this
  to *templates*: large, slotted patterns with attached plans and typical moves
  ([review](https://pubmed.ncbi.nlm.nih.gov/9709441/)). Bilalić et al. 2009: players specialised in an
  opening recall and solve positions from *that* opening at the level of players one standard deviation
  stronger ([Cognitive Science](https://onlinelibrary.wiley.com/doi/full/10.1111/j.1551-6709.2009.01030.x)).
  Departure-from-theory archival study (76,562 games): Class B players leave theory at ~10.5 ply,
  Class A ~12, CM ~13.5, masters ~18, linear in Elo; masters hold on the order of 100,000 memorised
  opening moves ("monochrestic" knowledge), *organised by templates*
  ([PLOS One](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0026692)). Charness
  et al. 2005: serious study alone is the strongest predictor of rating
  ([ACP](https://onlinelibrary.wiley.com/doi/10.1002/acp.1106)). Gobet & Jansen (*Training in chess: a
  scientific approach*): small repertoire first, rote learning *is* necessary but link positions from
  several viewpoints (strategic pass, then tactical pass), learn the typical middlegames/endgames of your
  openings, use the computer to practise typical positions
  ([PDF](http://chrest.info/fg/preprints/Training_in_chess.PDF)).
- **Strength.** Foundational, replicated for 50 years.
- **Implication.** Two things are both true: sequences must be memorised, *and* memory that isn't
  keyed to positions is brittle. So (a) card = position (already), (b) test recognition ("which line is
  this? whose move? what's the plan?") not only production, (c) attach a plan to each line end from the
  PV, (d) depth budget by level: a novice gains nothing from ply 20 of a Zaitsev sideline.

### 2.9 Feedback timing

- **Finding.** Kulik & Kulik 1988: in applied settings with real material immediate feedback wins; lab
  studies of fact retention over ~1 week favour delayed ([ERIC](https://eric.ed.gov/?id=EJ375720)).
  Butler et al. 2007: delayed feedback better at 1 week, no difference at 1 day. A 2026 meta-analysis of
  computer-assisted learning finds the difference small and moderated by task
  ([EPR](https://link.springer.com/article/10.1007/s10648-026-10117-8)).
- **Strength.** Moderate; effects are small either way.
- **Implication.** Keep immediate correction for moves (a skill, applied setting). Get the "delayed"
  benefit by *re-testing later in the session* and in later sessions — already in the Practice design
  ("card comes back at the end of the session"). Do not withhold the correction.

### 2.10 Motivation: SDT, curiosity, rewards, gamification

- **Finding.** Deci, Koestner & Ryan 1999 (128 studies): expected, contingent rewards undermine
  intrinsic motivation (engagement-contingent d = −0.40, completion −0.36, performance −0.28);
  *informational* positive feedback does not
  ([PDF](https://depts.washington.edu/techdocs/papers/deciExtrinsicRewardsAndIntrinsicMotivation99.pdf)).
  Sailer & Homner 2020: gamification has small–medium effects (cognitive g = 0.49, motivational 0.36,
  behavioural 0.25), strongest with game fiction and social elements
  ([EPR](https://eric.ed.gov/?id=EJ1245270)). Curiosity is an information-gap emotion (Loewenstein);
  Kang et al. 2009 show an inverted-U with confidence and better memory for high-curiosity items
  ([Psych. Sci.](https://journals.sagepub.com/doi/abs/10.1111/j.1467-9280.2009.02402.x)). Streaks raise
  short-term retention (Duolingo: next-day retention 12% → 55%) but shift effort to quantity and produce
  "obligation" and burnout ([Decision Lab](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification)).
  Chessable users and authors say the same: "fun doesn't mean good", streaks and XP "don't improve your
  actual chess" (Ikeda, [10 pitfalls](https://juntaikeda.substack.com/p/3-lifetime-repertoires-the-10-pitfalls)).
- **Strength.** Strong for the undermining effect and for curiosity; gamification meta-analyses are
  heterogeneous.
- **Implication.** Competence feedback (mastered lines, retention trend, "you now punish 9 of 12
  traps") is safe and motivating. Secret lines are a curiosity mechanic — keep, but size the gap
  per variation. No streaks, no XP, no badges; a **finite session with a "done" state** and visible
  long-term progress instead.

---

## 3. What existing tools do, and where they fall short

| Tool | What it does | Where it falls short (users/coaches) |
|---|---|---|
| **Chessable MoveTrainer** | Author courses + SRS; active recall of each move; "implicit and explicit learning" ([MoveTrainer](https://www.chessable.com/movetrainer/)) | "Good for memorization, terrible for learning" ([thread](https://www.chessable.com/discussion/thread/828448/movetrainer-for-memorization-good-for-learning-terrible/838113/)); "playing correct moves I couldn't explain"; the why lives in annotations nobody reads ([CheckmateX](https://checkmatex.app/blog/chessable-review-i-tried-it-for-30-days)); SRS treats a 3% sideline like the main line; no deviation detection; streak/XP gamification; users leave the platform to test recall (Ikeda) |
| **Chessbook** | Repertoire builder from rating-band game data, "coverage" of what you'll face, game review, plan suggestions ([comparison](https://darksquares.net/blog/chess-training-apps/best-chess-opening-trainers-2026-compared)) | Move cap on free tier; rating-band data is the thing this project has deferred; still a book-only trainer |
| **ChessTempo** | Own repertoire, SRS, "review in order" and random-position modes, game analysis showing where you deviated | Dated UI; repertoire authoring burden; book-only |
| **Listudy** | Free, PGN/Lichess-study SRS | Minimal; no deviation handling, no explanations |
| **ChessAtlas** | FSRS, deviation finder from imported games, transposition merging | Small catalog; the same "drill the book" loop |
| **Lichess** | Explorer + "practice with computer"; Explorer Practice plays replies at real-world frequency | No scheduler, no deviation detection, no feedback beyond engine eval |
| **Chess.com** | Practice mode over lessons/openings | No SRS over custom trees, paywalled |
| **Aimchess** | Diagnoses "opening leaks" from your games | "Tells you WHAT to work on, lighter on the how" ([review](https://checkmatex.app/blog/aimchess-review-2026-is-it-worth-it)) |
| **OpeningTree** | Aggregates your games into a tree | Unmaintained since 2022; diagnosis only |
| **Anki decks** | Any card type, full schedule control | Set-up burden; users report poor retention without "the story behind the moves" ([Zwischenzug](https://zwischenzug.substack.com/p/spaced-repetition)) |

**Recurring complaints, in the users' own framing:** memorising without understanding; lines too long
for the level; forgetting after a month; "the software just tells you that you got it wrong"; opponents
deviate on move 5 and "9 times out of 10 the first non-book move has no clear tactical refutation"
([chess.com](https://www.chess.com/forum/view/chess-openings/training-against-non-standard-opening-moves)).
That last observation is important for [[Off-book Practice]]: a drill that only ever shows *punishable*
deviations teaches the false belief that every deviation is punishable.

**Coaching consensus** (Gobet & Jansen; Silman's plans-from-pawn-structure; the coach guides surveyed
[here](https://shop.worldchess.com/blogs/news/how-to-study-chess-openings) and
[here](https://chessatlas.net/blog/opening-repertoire-building/how-to-study-chess-openings-the-complete-2026-guide-for-every-rating-level)):
small repertoire; ideas and pawn structures before move orders; model games; typical plans; traps; test
yourself away from the tool; below ~1800, if most study time is move orders "you are on the wrong layer".
Nobody in the table above operationalises "ideas before move orders" with anything but prose.

---

## 4. Critique of the current design against the evidence

### Explore — what is already right

- Generation from the first move, no arrows by default, hints that cost the discovery (2.1, 2.4, 2.7).
- Good moves never interrupt; mistakes stop play with a choice (2.5, 2.9).
- Book replies weighted toward unfound lines and discounted when unsound — novelty steering without
  rating data, and the learner meets dubious theory to punish (2.10 curiosity; [[Coached Free Play]]).
- Dubious lines separated; no eval bar while learning (2.4 — fluency cues removed).
- Per-variation "still secret" counts are the right *size* of information gap (2.10).

### Explore — what is risky or wrong

1. **One-shot discovery.** Nothing brings a discovered line back. "Discovered" is recorded once and
   never decays, so the headline stat measures exposure, not knowledge (2.1, 2.2). This is the single
   biggest gap.
2. **Is trial-and-error discovery efficient for novices? Not as it stands.** At an entrance with 4–6
   book moves the novice picks blind. The pretesting effect requires the answer to follow the failed
   attempt; here a *good* non-book move continues silently and a *book* move that leads nowhere yet is
   indistinguishable from one that does. For an owner-level player this is fine; for the [[Public MVP]]
   novice it is a random walk with occasional confetti. Needs the fade-in scaffold of 2.7.
3. **The collection mechanic rewards the catalog, not the opening.** Line ends are where Lichess's
   naming stops — a data artefact at wildly varying depths, including many one-move sidelines. 259
   Sicilian leaves counted equally tell the learner to be a completionist over lines a novice will
   never face, and the app has no popularity data to say which matter. It *does* have soundness,
   sharpness and depth from the engine; use them to weight. Count-based collection is acceptable only
   as informational feedback (2.10) — it must not become the goal.
4. **Lines discovered by the computer's move** credit the learner with nothing (open item in
   [[Exploration Mode]]). Under 2.1 that entry should be "seen", not discovered, until reproduced.
5. **No "why".** A stopped mistake gets Try again / Play on and at most an arrow. The evidence says
   the correction is where the learning happens (2.5, 2.6), and the PVs to power it are already in the
   bundles.
6. **No recognition tasks.** Everything is production (play the move). Template building wants
   "where am I / what's the plan here" as well (2.8).

### Practice — what is right

FSRS per position; fail → one unhinted retry → reveal *and play it*; the "known" definition with a
random mid-track start and the name hidden (2.4, 2.8); attempt log with response time (a free
confidence proxy for 2.5).

### Practice — what is risky or wrong

1. **Two truths.** Practice drills a single-move-per-position tree built from engine best; Explore
   teaches catalog lines. A learner who discovers 3...a6 in Explore may be graded "soft" for it in
   Practice. Line mastery must be built on *discovered lines* (as [[Progress Tracking]] now says), and the
   engine-best tree becomes the fallback past the catalog.
2. **No interleaving across openings** and no confusable-pair contrast (2.3).
3. **Session has no shape** — no finite unit, no "done", so no habit anchor (2.10).
4. **No off-book work yet** — the loudest user complaint about every competitor (3).

---

## 5. Feature proposals, ranked by (learning impact × engagement) / effort

Scores are judgement calls: impact and engagement 1–5, effort S/M/L. Ranking is by the ratio.

### P1. Line mastery: FSRS over discovered lines · impact 5 · engagement 4 · effort M

- **UI.** A *Review* surface (see P3). It replays a discovered line from a random start point in it,
  name hidden, computer plays the other side's book moves; the learner must reproduce their moves to the
  line's end. Pass = every decision correct without a hint. The line card shows "Remembered · next in
  9 days". The opening page's split bar gains a third state: discovered → remembered → mastered.
- **Principle.** 2.1, 2.2 (successive relearning), 2.8 (position-keyed, name hidden).
- **Data.** Discoveries + attempts (have); FSRS state per line *and* per decision (ts-fsrs, have).
  "Mastered" = every decision recall ≥ 0.9 and line stability ≥ 21 days, per [[Progress Tracking]].
- **Effort.** M — a walk over book lines already exists in Explore; add scheduling and the random start.
- **Measure.** 7- and 30-day unaided replay success of discovered lines (target > 85%); share of
  discovered lines that reach "mastered"; review load per day stays under ~5 min for a 30-line learner.

### P2. Refutation feedback: "why", from engine PVs, and play the punishment · 5 · 4 · M

- **UI.** On a stopped mistake, the notice shows the punishing move *as a question*: "Why is …f6 bad?
  Find White's reply." The learner plays the refutation from the other side (one try, then the arrow),
  then sees the engine line unfold 3–6 plies with the concrete gain named from board facts ("wins the
  e5 pawn", "f7 falls", "opens the e-file on your king"). Then back to the position, Try again.
- **Principle.** 2.5 (errors + elaborated correction; generation of the correction), 2.6.
- **Data.** Bundle evals and PV moves (have — cache stores 18 PV moves); board facts computed with
  chess.js (material change, attacked undefended pieces, king exposure). In-browser [[Stockfish]] for
  off-book positions (have). No prose beyond computed facts, per the no-LLM rule.
- **Effort.** M.
- **Measure.** Repeat-error rate on the same position within 7 days (should drop by half vs the current
  arrow); share of learners who choose Try again over Play on.

### P3. "Today": a finite daily session · 4 · 5 · M

- **UI.** One button on the home page: *Today · ~10 min*. Order: (1) due line reviews, interleaved
  across the learner's openings (P1, P4); (2) one Explore run in the opening with the most "almost
  found" lines; (3) one punish drill (P6). Ends on a summary: lines remembered, one line found, one trap
  punished, next review date. No streak. A calendar heat strip shows sessions done, nothing else.
- **Principle.** 2.2 (spacing needs a daily surface), 2.3 (interleaving lives here), 2.10 (finite,
  competence-framed, no contingent rewards).
- **Data.** FSRS due queue, discoveries (have).
- **Effort.** M — composition of existing modes plus a scheduler.
- **Measure.** Session completion rate; D7/D30 return; median session length; review backlog size.

### P4. Confusable-pair interleaving ("Twins") · 4 · 3 · M

- **UI.** In Review, when a position is due, the scheduler prefers to follow it with a *twin*: a
  position within the learner's discovered lines that differs by ≤ 2 squares and has a different
  correct move (with/without …a6, Bb5 vs Bc4, one tempo apart). The card notes "Compare with the last
  position" after both are answered, showing the two boards side by side with the differing squares
  marked.
- **Principle.** 2.3 (discriminative contrast is the mechanism), 2.8.
- **Data.** EPD tree + evals (have). Twins computed offline per bundle by board distance; store as a
  list per position.
- **Effort.** M (S for the pipeline, M for the review UI).
- **Measure.** Confusion errors — playing the twin's move — as a share of all errors, before/after.

### P5. Preview-then-reproduce on-ramp for novices · 4 · 4 · M

- **UI.** At a fresh entrance, a learner with no discoveries in that variation may tap *Show me one*.
  The computer plays *both* sides along one line, but before each learner-side move the learner
  **predicts** it (a guess, immediately confirmed or corrected, never graded). The line is marked "seen"
  with a hollow pip. Reproducing it unaided in a later session — not the same one — upgrades it to
  discovered. The option fades: after N discoveries in a family it is offered less prominently.
- **Principle.** 2.7 (worked examples for novices, assistance on demand, fade), 2.5 (prediction is
  generation; failed prediction + immediate answer is the pretesting effect).
- **Data.** Book lines (have); a new "seen" stage in discoveries.
- **Effort.** M.
- **Measure.** Time-to-first-discovery for new accounts; discoveries per session in the first week;
  share of "seen" lines later reproduced.

### P6. Trap and punish-the-blunder drills · 4 · 4 · M

- **UI.** *Punish* mode per opening: "You face the King's Gambit. Punish it." Positions come from
  (a) the catalog's dubious lines (learner on the *other* side), (b) [[Coached Free Play]]'s planted
  mistakes, (c) [[Opening Classification]]'s traps once built. One-third of items are **non-punishable**
  deviations where the pass is any sound developing move and the feedback is "nothing to punish —
  develop"; without these the drill teaches overreach (section 3).
- **Principle.** 2.5 (errorful learning with elaborated correction), 2.8 (templates with attached
  tactics), section 3 (the calibration insight).
- **Data.** Dubious flags and evals (have); planted-mistake candidates (have); off-book evals need the
  native-Stockfish pipeline fallback ([[Off-book Practice]]).
- **Effort.** M for (a)+(b); L with off-book generation.
- **Measure.** Punish success rate; false-punish rate on non-punishable items (should fall over time).

### P7. Fast-and-wrong gets more: hypercorrection from response time · 3 · 3 · S

- **UI.** Nothing new to tap. A wrong move played fast (below the learner's own median for that depth)
  is treated as a high-confidence error: the P2 refutation is shown in full, the position is re-queued
  earlier in the session *and* the next day, and it is listed under "surprises" in the session summary.
  A slow wrong move gets the ordinary treatment.
- **Principle.** 2.5 (hypercorrection; high-confidence errors return if the correction is forgotten).
- **Data.** Response time per attempt (have).
- **Effort.** S. Nobody in the table in section 3 does this.
- **Measure.** Recurrence of fast-wrong errors vs slow-wrong errors after 7 days.

### P8. "Where am I?" recognition cards · 3 · 3 · S

- **UI.** A card shows a position from a discovered line: *which line is this?* (4 catalog names,
  siblings preferred as distractors), *whose move?*, and later *what's the plan?* (P9). Two seconds a
  card; mixed into Review at ~1 in 5 items.
- **Principle.** 2.8 (templates are recognised, not only produced), 2.3 (distractors are siblings —
  discriminative contrast).
- **Data.** Catalog names and EPDs (have).
- **Effort.** S.
- **Measure.** Recognition accuracy over time; correlation with production success on the same lines.

### P9. Plans from the PV: structure and plan cards · 4 · 3 · L

- **UI.** Each line end gets a *plan strip* computed from the engine's continuation: the pawn breaks
  (e.g. "…d5 break", "f4–f5"), piece manoeuvres ("Nf3–d2–f1–g3"), castling side, and the pawn skeleton
  drawn as a mini-board. Lines that reach the same skeleton are grouped on the opening page ("these 9
  lines lead to the Maroczy structure"), so the 259 leaves collapse into a dozen structures. The Review
  card can ask "which break is coming?" as a recognition question. Later, hand-written notes per
  structure for the owner's openings.
- **Principle.** 2.8 (templates with attached plans; Gobet & Jansen's "several viewpoints"), 2.6,
  coaching consensus (pawn structure → plan).
- **Data.** PV moves (18 in the cache — enough for breaks and manoeuvres in most lines; extend with
  native Stockfish offline for line ends), pawn skeleton from EPD (compute). No human prose needed for v1.
- **Effort.** L (pipeline + UI + grouping).
- **Measure.** Learner performance in [[Coached Free Play]] past the line end (win-chance drop per move
  in the first 6 off-book plies) for lines with vs without plan strips.

### P10. Relevance-weighted discovery counts · 3 · 3 · S

- **UI.** The headline count becomes *main lines* vs *sidelines*: a line's weight = soundness ×
  sharpness × (depth beyond the entrance ≥ 2 plies), normalised. One-move leaves stop counting in the
  headline; they move to a "sidelines" fold. The computer's reply weighting already uses soundness; add
  the same weight to the count. Later, when a *learner-chosen* level exists, cap depth.
- **Principle.** 2.10 (information gap sized to matter), section 3 (SRS treating sidelines like main
  lines is a known Chessable complaint), 2.8 (depth by level).
- **Data.** Soundness, sharpness, depth (have). No popularity data required.
- **Effort.** S.
- **Measure.** Share of session time spent in main lines; learner-reported relevance (one question in
  the session summary, occasionally).

### P11. "Explain it back": verifiable self-explanation prompts · 3 · 2 · M

- **UI.** After a discovery, one optional tap: "What does 9.h3 do?" with 3 computed options (prevents
  …Bg4; prepares g4; defends g2) and one distractor. Correct answers come from board facts + the PV
  (the move's effect on pins, squares controlled, the next planned break).
- **Principle.** 2.6 (self-explanation g = 0.55; must be answerable), no-LLM rule respected.
- **Data.** chess.js board analysis + PV (have). Reliability of the auto-generated "purpose" is the
  risk; ship only fact types that are provably true (prevents X = X was legal before and isn't now;
  prepares Y = Y appears in the PV within 4 plies).
- **Effort.** M.
- **Measure.** Retention of lines with an explanation prompt vs without (A/B by line).

### P12. Opening pretest ("Play first") · 2 · 3 · S

- **UI.** Opening a new opening for the first time: "Play five moves as you would." The computer
  answers with book. Then the defining moves are revealed with the learner's moves marked where they
  matched or differed.
- **Principle.** 2.5 (pretesting effect), 2.10 (curiosity).
- **Data.** Book (have).
- **Effort.** S.
- **Measure.** Discoveries in the first session with vs without pretest.

### P13. Off-book practice, calibrated · 4 · 4 · L

Already designed in [[Off-book Practice]]. Two changes from this research: include non-punishable
deviations (P6) so the learner learns *when not to punish*, and continue play 4–6 plies after the
punishment so the learner converts, which the design already proposes. Effort is L because of the
native-Stockfish fallback.

### P14. Deviation finder from the learner's own games · 3 · 4 · L

Import Lichess/chess.com games, find where the learner left their discovered lines, queue that
position for review and, if the opponent deviated, into P6. Every competitor with a scheduler is
adding this; the differentiator here would be the punishment drill, not the finder. Needs OAuth or
public-game APIs and a legal read of both sites' terms. Later.

### P15. Structure-first entry for Black repertoires · 2 · 2 · L

A "reversed" mode: start from a typical middlegame of the opening (a discovered line's end) and play
it out coached, *before* drilling the moves that reach it. Gobet & Jansen's decomposition idea applied
to the opening. Interesting; low priority until P9 exists.

---

## 6. Suggested roadmap — the next three builds

1. **P1 + P3 together: line mastery with a daily Review session** (M+M).
   Reason: it converts what Explore already produces (discoveries) into retained knowledge, and it is
   the only thing on the list with effect sizes above 1. The session is the surface the review needs,
   and it is where interleaving (P4, cheap once Review exists) and P8 recognition cards slot in later.
   Everything here is derivable from data the app already logs. Ship with the three-state bar
   (discovered → remembered → mastered) so progress becomes visible as retention, not exposure.
2. **P2 + P7: refutation feedback with play-the-punishment, and hypercorrection from response time**
   (M+S). Reason: it fixes the one place where the app currently wastes its best moment (the mistake),
   uses data already in the bundles, and directly answers the dominant complaint about every competitor
   ("it just tells you that you got it wrong"). P7 is a few lines on top of P2 and is genuinely novel.
3. **P5 + P10: the novice on-ramp — preview-then-reproduce, and relevance-weighted counts** (M+S).
   Reason: the [[Public MVP]] target is a novice; the evidence says pure secret discovery is too hard
   for them and the catalog-leaf count points them at the wrong lines. Both keep the owner's principle
   (a seen line is never counted until reproduced unaided) while giving the novice a schema to
   generate from. Measure time-to-first-discovery before and after.

Then P6 (punish drills) as the bridge to [[Off-book Practice]], and P9 (plans from the PV) as the
long-term differentiator that no tool in section 3 has: "ideas before move orders", computed from
engine truth rather than written as prose.
