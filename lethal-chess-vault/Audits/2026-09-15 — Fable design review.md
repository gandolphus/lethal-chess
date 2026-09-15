---
tags: [audit, design, fable]
aliases: [Fable design review]
---

# 2026-09-15 — Fable 5.1 design review

Adversarial review of the plans against the user's goals for the day. Commissioned read-only;
report preserved here close to verbatim. Our verification of its key claims is at the bottom.
Outcomes: [[Opening Classification]], [[Opening Drills]], [[Decision Log]].

**The goals it reviewed against:** (1) classify all openings by relative strength, with weaknesses
per opening (e.g. the King's Gambit for White), and drill those weaknesses; (2) drill the English
(White) and Sicilian (Black) against all common responses.

## Facts it verified

- Catalog: 3,810 lines, 500 ECO codes, 0 duplicate PGNs, **0 terminal-FEN collisions** (pure tree),
  7,854 distinct positions on all paths; 2,459 leaves. Depth: 30% ≤ 6 plies, 61% ≤ 10, 84% ≤ 14.
  Median KG 9 / English 8 / Sicilian 11.
- Cloud eval: **22/22 hits** across deep KG / English / Sicilian positions, depth 37–65.
- **Offline eval database** `database.lichess.org/lichess_db_eval.jsonl.zst` — 22.1 GB, 409.7M
  positions, CC0, updated 2026-09-10. Replaces API polling entirely.
- Explorer `/lichess` `/masters` `/player` all 401 anonymously.
- Native Stockfish 18: 0.57 Mnps single-thread; depth 22 in 1.7–5.8 s/position.
- python-chess: **868 games/s** full parse (16 plies); **41k games/s headers-only**.
- **The old analyzer's scoring was one signal wearing five hats.** `aggregate_store.py:302-306`
  derives error, conversion *and* "engine soundness" all from the mover's score rate. There was
  never engine output in it.

## A. Critique of the existing plan

1. The vault contradicted today's goals: it parked the lethality pipeline, but goal 1 *is* that
   pipeline.
2. The Opening Drills question list was ~80% scheduling/UX and 0% data. "You cannot schedule
   content you don't have." Missing: content source, rating band, time controls, rating pool,
   offline build vs runtime.
3. **Do not port `scoring.py`.** Redesign with genuine evals.
4. Architecture: framework-agnostic core correct and paying off; hand-rolled board fine; WASM
   in-browser correct for the opponent and for checking a deviating move mid-drill, **wrong for batch
   analysis**; no backend correct for now; persistence should be local-first (IndexedDB).
5. Under-scoped: no rating band anywhere; the user's own games ignored. Over-scoped: *classifying*
   all 3,810 is achievable, *weaknesses* for all probably isn't — human move data is only dense for
   popular lines at a given band.
6. Transpositions: catalog is collision-free, but the English transposes constantly (→ QGD / Slav /
   KID). **Stats keyed by position (EPD), names stored on paths.**

## B. Goal 1 — strength and weaknesses

**Strength is two numbers, never blended by fixed weights:**

- **Objective cost** `S(o) = eval(P) − eval(best alternative at parent)`, depth ≥ 30 from the eval
  db. A delta, not an absolute eval — absolute conflates "the other side is fine" with "this
  choice was bad". KG: 2.f4 at −0.39 vs 2.Nf3 ≈ +0.3 ⇒ cost ≈ 0.7.
- **Practical edge** `H(o, band)`: mean score in games reaching P, minus expected score from the Elo
  gap, minus the colour baseline, shrunk toward 0 with a Beta prior (n₀ ≈ 200) so thin lines can't
  top the list.

Rank by H, show S as a ceiling. The gap `H − g(S)` is the **trap value** — engine −0.4 but a
winning score at 1500 is not a contradiction, it is the KG's entire point. Failure modes it named:
selection bias (KG players are specialists), H measuring the whole game rather than the opening,
bullet noise (exclude it).

**Weakness** `W = (position, move, engine PV ≥ 6 plies, stats per band)`, three detectable classes:

1. **Refutation** — opponent move with eval swing ≥ 40cp *and* the opening side's most-played reply
   loses a further ≥ 60cp (humans don't find the defence). KG: 3.Bc4 Qh4+ (verified).
2. **Trap the opening side falls into** — their move played ≥ 10% at the band, eval drop ≥ 80cp.
3. **Practical weakness** — opponent move where the practical score drops ≥ 5 pts, n ≥ 500, but the
   engine barely cares.

Ranked by `frequency × damage × (1 − rate the opening side answers correctly)`. Thresholds are
starting guesses, to be tuned on lines with known answers.

**Explanations without hallucination, ground truth first:**

1. The engine PV itself — always shown, playable on the board.
2. Template facts computed at build time: material along the PV, undefended pieces, lost castling
   rights, lines opened to the king ("e1–h4 diagonal opened by f2-f4"), pins, forks. ~20 templates.
3. Hand-curated prose for the user's own openings.
4. LLM last and optional: composes from (1)+(2) only; every square/piece/move it names is checked
   against the position and PV, unverifiable sentences dropped. **Never the source of chess content.**

**Drill side: exploit first** — play the opponent, find the punishing move. A single decision point
with an engine-verified answer is a clean card. Navigating the opening from its own side needs the
full defensive tree, which is goal 2's machinery anyway.

**Pipeline, offline and native:** stream the monthly dump → python workers → sqlite of
`(position, move, band, n, w/d/l)`, ~15 min per 10M games on 20 workers. A **headers-only pass over
all ~100M games** using Lichess's `[Opening]` header gives popularity + practical score per named
opening per band in ~40 min single-core — *that alone is the "classify all openings" deliverable*.
Evals joined from the eval db; gaps filled by native Stockfish. **Ship per-opening JSON bundles**
(`openings/C30.json`), loaded lazily; no backend.

## C. Goal 2 — repertoire drilling

- **Common responses:** opponent replies ≥ 5% at the user's band, plus top-k to 85% cumulative,
  n ≥ 100; stop below 0.5% of the opening's games or past ply 20. At ~1500 on Lichess the
  anti-Sicilians are a large share of `1.e4 c5` — a Najdorf-only repertoire drills the minority
  case. Measure before choosing.
- **Model:** `Repertoire{side}`, `Node{epd}`, `Edge{uci, kind: mine|theirs, weight}`; exactly one
  `mine` edge per user-to-move node. **Card = (repertoire, position)**, EPD-keyed so transpositions
  share a card.
- **Scheduling:** FSRS per card, but the **session unit is a line walk** from the root; every card on
  the path gets graded, which handles correlated positions by construction.
- **Failure:** flash → engine judges how bad (WASM, 300 ms) + human cost if known → one unhinted
  retry → reveal *and make them play it* → continue the line → re-queue end of session.
- **"Known":** ≥ 3 consecutive passes at interval ≥ 21 days, median < 8 s, and at least one pass
  from a random mid-line start with the opening name hidden.

## D. Build order

Today: catalog import with position index → drill v0 on the catalog tree (forced orientation,
opponent plays catalog children, user must play the catalog move) → local card state → kick off the
headers-only dump tally in the background.

**Riskiest assumption:** that human data at the user's band is dense enough at plies 10–16 to find
weaknesses in *less popular* openings. Test on 2M games: KG positions with n ≥ 100 at ply 12 in the
user's band. If that's under ~50, niche-line weaknesses are engine-only and goal 1's promise changes.

## E. Risks

- Stockfish GPL: offline batch use is not distribution; evals are facts. Browser WASM unchanged.
- Lichess dumps, eval db and catalog are all **CC0**. Don't crawl the explorer.
- Lichess rating ≠ chess.com rating. Single month. Eval-db depth varies (filter ≥ 20).
- Scope creep: "all openings classified" is a visualizer product; the daily-useful thing is two
  repertoires drilled. Keep them separate features sharing one data layer.

## Our verification

- Old scoring claim — **confirmed**: `aggregate_store.py:305`, `eval_cp = int((score_rate - 0.5) * 420)`.
- Eval db — **confirmed**: HTTP 200, 22,086,532,809 bytes, last-modified 2026-09-10.
- Catalog integrity — **confirmed independently**: our `scripts/build-catalog.js` replays all 3,810
  lines through chess.js, 0 failures, 0 terminal collisions.
