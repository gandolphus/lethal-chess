---
tags: [research, data, licensing]
aliases: [Popularity data, Explanation data]
---

# Popularity and explanation data

Research note, **2026-09-16**. Two gaps in [[Data sources]]: (A) how often humans play each move, so that
[[Exploration Mode]] can weight replies, mark main lines and extend thin openings; (B) short, true
explanations of book moves. Everything below was checked today unless marked *not verified*. Licensing
context: the app is AGPL-3.0 with a GPL engine ([[Engine licensing]]); bundles are static JSON on a CDN,
so anything in them is *redistributed*, not merely displayed.

## A. Human move popularity

### Comparison

| Source | License | Access | Size / freshness | Static-bundle verdict | Effort | Value |
| --- | --- | --- | --- | --- | --- | --- |
| **Lichess monthly game dumps** | **CC0** ("use them for research, commercial purpose, publication, anything you like") | HTTPS/torrent, range requests work, streamable | 2026-08: **30.1 GB zst, 91,912,325 rated games**; new month ~10th of next month | **Yes.** Aggregates are ours | Medium (one streaming pass; see plan) | High: any rating band, results, every position |
| Lichess Opening Explorer API (`/lichess`) | Not stated for the aggregates; underlying games CC0 | **401 without a token** (verified today, `explorer.lichess.ovh` and `.org`). OpenAPI spec now declares `security: OAuth2` on `/masters`, `/lichess`, `/player`; a zero-scope personal token suffices per third-party reports (change dated ~March 2026, *not verified* against a Lichess announcement). Rate limit: "only make one request at a time", 429 → wait a full minute; Lichess: "we would much rather add an endpoint than have people use web-scraping" and ToS reserves "reasonable caps… at Lichess' discretion" | Live, complete, updated continuously | **No for bulk.** Crawling ~50k positions with a personal token is against the spirit of the API tips; fine as a *live, user-token* panel later | Low (live) | High live, nil offline |
| Lichess masters database (`/masters`) | **Not stated.** OTB games of 2200+ FIDE players, 1952 – Aug 2024, ~2.0–2.7 M games; originally supplied by Tony Rottella (2016); current sourcing "unknown" per forum | Same token-gated API; **not downloadable** (repeated forum requests declined for storage reasons) | Stale by two years | **No.** Unlicensed aggregates, no dump | — | Would be the "theory" band; unavailable |
| Lichess Elite Database (nikonoel) | Derived from the CC0 dumps, so CC0 in substance; no explicit notice | Monthly PGN files | 2500+ vs 2300+ (since 2021-12), 60–100 MB/month, **last file 2025-11** | Yes, but the dump filter above gives the same and is current | Low | Medium: a cheap "strong Lichess" band |
| Lichess puzzle database | **CC0** | `lichess_db_puzzle.csv.zst`, 304 MB, updated 2026-09-09 | 6,100,952 puzzles; `OpeningTags` column for positions before move 20 | **Yes** | Low | Medium: real traps per opening (see B) |
| `lichess-org/chess-openings` extras | CC0 | `dist/` adds `uci` and `epd` columns; also Parquet on Hugging Face | 3,810 lines, pushed 2026-08 | Yes (already used) | — | No popularity, no depth beyond what we have |
| Chess.com Published-Data API | Not stated for data; "respect our IP" | Per-player monthly archives only; serial requests unlimited, parallel → 429; "complete lists of all players are not available" | Live | **No**: no explorer endpoint, no bulk, no license | — | Nil |
| KingBase | **None stated**; site `kingbase-chess.net` gone, archive.org mirror (KingBase 2019, 872 MB) | Archive.org | ~2.2 M games 2000+, since 1990, **last 2019** | **No** (unlicensed, stale) | — | — |
| Caissabase | None stated; "no longer available" as of 2025 | — | ~3.9 M games | **No** | — | — |
| TWIC (The Week in Chess) | "**free for personal use only. All rights are reserved.**" | Weekly zipped PGN, issue 1662 = 6,671 games | >4 M games since 1994, weekly | **No.** Personal use only; even derived counts are a grey area | — | Would be the best OTB source if licensed |
| FICS games database | No license text found; site **unreachable today** (`ECONNREFUSED`) | Download by month/rating (historically) | 268 M games 1999–2026 | No: unlicensed, server-rated, weaker population than Lichess | — | Low |
| CCRL | Engine-vs-engine | — | — | Irrelevant to human popularity | — | — |

Verdict: **the monthly dump is the only source that is both open and current.** Everything OTB
(masters, TWIC, KingBase, Caissabase) is either unlicensed, personal-use-only or dead. The masters
band has to be approximated by Lichess ≥ 2200 (and, if wanted, the 2500+ Elite subset).

### Measured: first 400 MB of `lichess_db_standard_rated_2026-08.pgn.zst`

Streamed with a range request, `zstd -dc`, and a single-thread Python parser
(`/home/ohzo/.claude/jobs/eb2370b5/tmp/research/count.py`). **1,284,025 games (1.4 % of the month) in
451 s**, 2.57 GB decompressed (ratio 6.4×, so the month is ~190 GB of PGN). Bands by the *lower* of the
two ratings: < 1800: 801,825 · 1800–2199: 372,509 · ≥ 2200: 109,691.

Replies after **1.e4 e5 2.Nf3 Nc6 3.Bb5** (games where the position was reached and a move followed):

| Reply | < 1800 (n = 14,138) | ≥ 1800 (n = 5,929) | ≥ 2200 only (n = 1,445) |
| --- | --- | --- | --- |
| 3…a6 | 19.9 % | **34.7 %** | 42.1 % |
| 3…Nf6 | 21.7 % | 22.5 % | 34.6 % |
| 3…Bc5 | 14.0 % | 14.6 % | 7.1 % |
| 3…d6 | **24.1 %** | 13.6 % | 3.9 % |
| 3…f5 | — | 4.9 % | 7.0 % |
| 3…Nge7 | 5.8 % | 3.8 % | 3.1 % |
| 3…Nd4 | 5.5 % | 3.1 % | 1.3 % |

The band matters: under 1800 the Old Steinitz 3…d6 is the *most* common reply; at 2200+ it is 4 %.
Results in the ≥ 2200 band: 595 White wins, 537 Black wins, 316 draws.

Thin openings, ≥ 1800 band: **London** 2.Bf4 (n = 5,367): Nf6 34.5 %, e6 19.3 %, c6 13.8 %, c5 10.6 %,
Bf5 9.2 %, Nc6 8.5 % (under 1800, Nc6 is first at 26.6 %). **Danish** 3.c3 (n = 1,078): dxc3 56.8 %,
d5 13.8 %, Nc6 11.8 %, d3 7.1 %, Qe7 3.3 %. **Budapest** 2…e5 (n = 956): dxe5 57.9 %, Nc3 17.5 %,
d5 12.3 %, Nf3 7.0 %, e3 4.1 %.

Scaled to the month (× 71.6): about **425k** ≥ 1800 games reach the Ruy Lopez position, **384k** the
London, **77k** the Danish, **68k** the Budapest. Positions 10–12 plies deeper still get thousands of games,
so a 2-ply-deeper practical line for a thin opening is well supported.

Distinct move-sequence prefixes up to ply 10 among ≥ 1800 games in the sample: 947,596, of which 3,598 have
≥ 100 games and 353 have ≥ 1,000. A naïve "count every prefix" pass would not scale to ply 22 over the
full month; the plan below counts only positions we already know.

### Plan: popularity first

1. **Download** one month (30 GB, one-time; 934 GB free). Keep the month in `data/raw/`, gitignored, like
   the eval db.
2. **Target set.** Collect every node EPD from the 28 built bundles (drill nodes and book nodes) plus the
   EPDs one ply past each opponent node (so replies not yet in the bundle are counted too). Tens of
   thousands of EPDs; fits a `Map`.
3. **One streaming pass** (`pipeline/popularity/build.ts`): `zstd -dc | node`, worker pool of 12. Per game:
   skip if either rating < 1800 or the movetext is shorter than the shallowest root; replay at most 24 plies
   with chess.js; at each ply whose EPD is in the set, increment `games[band]` for the node and
   `moves[san][band]`, and record the result. Stop replaying at the first EPD outside the set past the root
   (the tree is a prefix-closed set, so nothing below can be in it). Cost: 34 M qualifying games × ≤ 24
   plies; the Python prototype parsed 2,850 games/s single-thread on full movetext, so **~1 h with 12
   workers** is the realistic budget. Output `data/cache/popularity-2026-08.json`.
   *Alternative:* run `lila-openingexplorer` (AGPL, Rust + RocksDB) locally and query it; heavier setup, more
   general than needed.
4. **Join in `pipeline/repertoire/build.ts`.** Bands: `1800` (1800–2199) and `2200` (≥ 2200). Store shares
   as fractions of games at the parent node.
5. **Use it.** Reply weight = current heuristic × `(0.1 + share)^α` with α ≈ 0.5, so rare-but-catalogued
   lines still appear. Main line = at each node, the catalogued continuation with the highest ≥ 1800 share;
   a `BookLine` is `main` if every move on it is the main one. For thin openings, add *practical lines*:
   from the root follow continuations with share ≥ 8 % and ≥ 300 games to ply ≤ 20; name them by the
   deepest catalog name plus the moves, flagged `source: 'popular'` so the UI can say "commonly played" rather
   than claim a name.
6. **Refresh** with a new month twice a year; the bundle records the month.

### Bundle schema addition (`src/lib/drill/bundle.ts`)

```ts
export type Band = '1800' | '2200';
export type Popularity = {
	/** Rated Lichess games reaching this node in the source month, by lower-rating band. */
	games: Record<Band, number>;
	/** White wins, draws, Black wins among those games, ≥ 1800 combined. */
	results?: [number, number, number];
};
// on Candidate and Reply:
share?: Record<Band, number>;   // fraction of the parent node's games that played this move
main?: boolean;                 // highest-share catalogued continuation at this node
// on BundleNode:
popularity?: Popularity;
// on BookLine:
main?: boolean;
source?: 'catalog' | 'popular';
// on Bundle.source:
popularity?: { month: string; minRating: number; games: number };
```

Size: two numbers per reply and one object per node, well under 10 % growth on the 575 KB Sicilian bundle.

## B. Explanations of moves, ideas and plans

### Comparison

| Source | License | Access | Coverage | Static-bundle verdict | Quality |
| --- | --- | --- | --- | --- | --- |
| **Wikibooks "Chess Opening Theory"** | **CC BY-SA 4.0** (dual GFDL). Reuse needs: link to the page (or author list), a CC BY-SA notice with license link, modifications indicated, changes under the same license | MediaWiki API, `prop=extracts` — exactly what Lichess's analysis board does (`ui/lib/src/wikiBooks.ts`, ending with "Read more on WikiBooks") | **3,038 pages** under `Chess Opening Theory/`; page name = one path segment per move: `…/1._e4/1...e5/2._Nf3/2...Nc6/3._Bb5`. Per launch opening (pages at or under the root): Italian 349, Caro-Kann 267, Sicilian 264, Ruy Lopez 258, Queen's Gambit 209, French 161, Slav 119, English 106, King's Gambit 79, Alekhine 69, QGD 63, Scandinavian 47, Vienna 40, Evans 31, Dutch 31, Budapest 30, Pirc 25, Danish 24, Dragon 23, Nimzo 20, Grünfeld 20, Scotch 14, KID 11, Smith-Morra 11, Benko 7, **London 6, Catalan 4, Réti 2**. Depth: half the pages are ≤ 7 plies deep; 1,000 pages at ≥ 10 plies | **Yes**, as CC BY-SA *content* next to AGPL *code*: the text stays CC BY-SA, ShareAlike binds only the text and our edits to it, not the app. Ship an excerpt, the page URL and revision id, and a license line in the UI and in a `LICENSES` note | Sampled: Ruy Lopez page (13.4 KB) explains the c6-knight pressure, the c3/d4 plan, each reply with a one-line idea; London page (6.4 KB) explains why Bf4 before e3, the e3/c3/Nd2/Nf3/Ne5 setup and Black's three plans; Danish page (3.2 KB) is a theory table plus 350 words. Uneven but sourced (Batsford etc.) and edited (all touched 2026-08). Prose is opening-level, not move-by-move past the first few plies |
| Wikipedia opening articles | CC BY-SA 4.0 | API extracts | One article per family/major variation; history-heavy | Yes with the same attribution | Good for the opening card, not for positions |
| `lichess.org/opening` descriptions | **Not stated**: user-edited markdown stored in Lichess's own MongoDB (`OpeningWiki.scala`), ToS grants Lichess a licence, none to us. Ruy Lopez page today: "No description of the opening, yet." | — | Sparse | **No** | — |
| Lichess puzzle `OpeningTags` + `Themes` | CC0 | Dump | (numbers below) | Yes | Real traps from real games, with a rating and play count |
| Engine-derived facts | Ours | Native Stockfish 18 + python-chess in the pipeline | Every node | Yes | See below |
| LLM prose | Ours, but risk of invented facts | — | — | Only as a renderer of checked facts, if at all | See below |

### Engine-derived explanations: what is reliable

Ranked by trustworthiness; all computable offline in `pipeline/` with the native engine already used.

1. **Refutation of a mistake** (already have: the PV after each candidate). Reliable. Render as "after
   3…Nd4 4.Nxd4 exd4 5.O-O White is better by 0.6": the numbers are the engine's own.
2. **Material swing along the PV.** Deterministic from the PV: count captures. Reliable; explains gambits
   ("White is a pawn down for development").
3. **Threat = best move after a null move.** Push `Move.null()` (python-chess) and search; skip when in
   check. Standard technique (ChessBase's "threat", Lichess's threat toggle). Reliable for tactical threats,
   noisy when the best "threat" is a quiet improving move; only show when the null-move eval jumps ≥ 1.0.
4. **Tactical motif tags** on the refutation PV: `lichess-puzzler/tagger/cook.py` (**AGPL-3.0, compatible**)
   detects fork, pin, skewer, discovered attack, hanging piece, trapped piece, deflection, attraction,
   clearance, intermezzo, back-rank and other mates, attacking f2/f7, sacrifice — with python-chess.
   Reliable enough that Lichess ships them as puzzle themes.
5. **Pawn-structure classification** (isolated, doubled, passed, open/half-open files, centre type).
   Deterministic; explanatory value moderate ("Black accepts an isolated d-pawn").
6. **Piece activity / mobility deltas.** Cheap but rarely says anything a learner can use; skip.
7. **Move classification** (blunder/mistake/inaccuracy): what the open-source "game review" clones do
   (Chesskit, OpenChess-Insights (MIT), WintrCat's freechess). None of them derives *plans*; their prose
   is templated over eval swings and the best line — the same facts as 1–3. Lichess "learn from your
   mistakes" is only a replay of mistakes with the eval; no explanation layer to borrow.

### LLM-generated explanations: risk assessment

An LLM asked "why is 3…a6 good" will produce fluent text with wrong squares, wrong plans and invented
history; in a precision-first product that is disqualifying. Two mitigations, neither making it a primary
source:
- **Grounded rendering only.** Give the model the structured facts (candidates and evals, PV, threat,
  motif tags, material swing, the Wikibooks excerpt) and require prose that cites only moves present in
  the input; verify every SAN token in the output against the input set and reject on any miss. This turns
  the model into a template engine with better grammar — templates do the same at zero risk.
- **Never for plans.** "Typical plans" are the thing an engine cannot verify; take them from Wikibooks (with
  attribution) or write them by hand for the 28 openings.

### Plan: explanations second

1. **Wikibooks excerpts at build time.** For every bundle node, derive the page title from the SAN path
   (the book keys by move order, so transpositions need the *first* catalogued order; try the node's
   canonical path, then the catalog `pgn` of the deepest named ancestor). Fetch `prop=extracts&exintro`
   with a proper User-Agent (the API returns 403 without one) and cache by revision id. Keep the first
   paragraph(s) up to ~600 characters, strip the theory table (Lichess's `transformWikiHtml` shows what to
   remove). Store `wiki?: { text, title, revision }` on the node; UI shows the text, "Read more on
   Wikibooks" and "CC BY-SA 4.0". Expect text mainly at entrances and the first 6–8 plies — that is where
   [[Exploration Mode]] shows the line card anyway.
2. **Engine facts** in the pipeline: `why?: { refutes?: string[]; threat?: string; material?: number;
   motifs?: string[] }` per candidate that the coach calls a mistake, rendered from templates. This is the
   "trap description" for free: a dubious line's punishing move plus its motif tags.
3. **Traps from the puzzle DB**: per opening, early puzzles (full move ≤ 12) tagged with the opening,
   sorted by plays; a `traps?: { fen, moves, rating, plays, themes }[]` on the bundle (source CC0).
4. **Hand-written plans** for 28 openings (one paragraph each, ours) if Wikibooks is thin for that opening
   (London, Catalan, Réti).
5. **No LLM** in the pipeline until 1–4 exist and a grounded renderer can be evaluated against them.

## Puzzle DB measurement

(See the section below; filled in from `puzzles.py` on the 2026-09-09 dump.)

## Scratch

`/home/ohzo/.claude/jobs/eb2370b5/tmp/research/` — `count.py`, `result.json`, `puzzles.py`,
`wikibooks_pages.json` (all 3,038 titles). No large files kept; the dump sample was streamed, not stored.

Related: [[Data sources]] · [[Exploration Mode]] · [[Engine licensing]] · [[Decision Log]]
