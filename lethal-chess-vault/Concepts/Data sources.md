---
tags: [concept, data, verified]
aliases: [Data sources]
---

# Data sources

What exists for classifying openings and finding their weaknesses. **Everything here was checked on
2026-09-15**; nothing is assumed. Feeds [[Opening Classification]] and [[Opening Drills]].

## Opening catalog — `lichess-org/chess-openings`

- **CC0-1.0**, actively maintained (last push 2026-08-04).
- 5 TSVs (`a.tsv`…`e.tsv`), columns `eco`, `name`, `pgn`. **~3,810 named lines.**
- Coverage spot-check: King's Gambit 192 rows, English Opening 174, Sicilian Defense 391.
- Names only — no stats, no evals. It is the *index*, not the classification.

## Lichess opening explorer — `explorer.lichess.ovh`

- `/lichess` and `/masters` both return **401 without auth** now. Needs the user's personal Lichess
  token. Rate limits unknown. Crawling it at scale is also a ToS question.

## Lichess cloud eval — `lichess.org/api/cloud-eval`

- **Works anonymously.** Deep evals: King's Gambit (`1.e4 e5 2.f4`) at depth 54 →
  `2...exf4 −39cp`, `2...d5 −12cp`, `2...c6 +9cp`.
- Only for positions someone has already analyzed; unknown positions 404. Good for the popular
  spine, useless for the long tail.

## Lichess eval database — `database.lichess.org/lichess_db_eval.jsonl.zst`

**The primary data source for the first rollout** (precision-first, [[Decision Log]]).

- 22.1 GB compressed, ~410M positions, **CC0**, updated 2026-09-10.
- One JSON object per line: `fen` (already an EPD — no move counters), `evals[]` each with
  `depth`, `knodes`, `pvs[]` of `{cp | mate, line}`.
- **Profiled on the first 64 MB (760k positions):**
  - Opening-heavy: 36% have ≥ 28 pieces, 45% ≥ 26.
  - Candidate lines per opening position: **5 for most** (58%); some 1–3, some 9+.
  - Best depth for ≥ 28-piece positions: p10 **20**, p50 **30**, p90 **42**.
  - En passant square written **only when a capture is legal** — same as chess.js, so EPD joins match.
- **Extraction benchmark** (node, prefilter by piece count on the raw line, parse survivors):
  ~490k lines/s single-thread → **~14 min for the whole file** at ≥ 26 pieces; compact cache
  est. **5–17 GB** depending on encoding. Temporary.

### ⚠ Castling is written king-takes-own-rook

The eval db uses the Chess960 convention: `e1h1` / `e1a1` / `e8h8` / `e8a8` (~42k occurrences in the
first 64 MB), not standard `e1g1`. **chess.js rejects that form**, so every position where castling is
among the candidate moves would silently break. The cache stores moves exactly as the source has them;
`pipeline/lib/uci.ts` `normalizeCastling()` converts them using the board — in standard chess a king
can never legally land on its own rook, so the pattern is unambiguous. Every cache consumer must call
it. Tested against chess.js.

### The cache as built

`pipeline/eval-cache/` — fixed 64-byte records sorted by an 8-byte SHA-1 key of the EPD, with a
16-bit prefix index. Each record: depth, up to 5 candidate moves with scores from **one** multi-PV
search (among evals within 8 plies of the deepest, the one with most candidates — mixing searches would
compare incomparable numbers), plus the first 18 moves of the principal variation.

**Verified on the 64 MB sample:** 341,640 records; cross-checked 20,562 sampled positions against the
source JSON — **0 missing, 0 mismatches**; 4 µs per lookup. Full-scale estimate: ~184M records,
**~11.8 GB**. Build: `pnpm pipeline:eval-cache data/raw/lichess_db_eval.jsonl.zst data/cache/evals`.

## Lichess monthly game dumps — `database.lichess.org`

**Not needed for the first rollout** — only rating-based features used it, and those are deferred.

- CC0. 2026-08 standard rated: **30 GB** `.pgn.zst`. Streamable — process the first N million games
  without downloading the whole file.
- This is the realistic source for *human* results by rating band.

## Old analyzer cache — `../chess-lethality-analyzer/backend/data/lichess_stats.sqlite`

- ~50k games from **2013-01** only; buckets `1200-1600` / `1600-2000` / `2000+`; `move_stats` has
  `mover_wins/draws/losses`.
- King's Gambit position: ~1,078 games total. **Too thin and too old** for sub-variation stats.
  The *pipeline code* is reusable ([[Lineage — from lethality analyzer to drilling tool]]); the
  data is not.

## Local compute

- 24 cores, 62 GB RAM.
- Native **Stockfish 18** via `nix shell nixpkgs#stockfish` — no system rebuild needed, far faster
  than WASM for batch analysis. ([[Stockfish]] in the browser stays the *opponent*; batch analysis
  is a separate, offline concern.)
- `zstd`, python-chess 1.11.2 (old venv), node 24.

## Implication

Classification is an **offline build step**: catalog (names) + dump (human results) + native
Stockfish / cloud eval (objective eval) → a static artifact the app loads. Design pending
[[Decision Log]].
