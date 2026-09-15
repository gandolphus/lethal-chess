---
tags: [decision, log]
aliases: [Decisions, ADR]
---

# Decision Log · lethal-chess

Dated, rationale-bearing record of locked decisions. See [[System Map]] for the resulting architecture, [[Home]] for vision.

---

## 2026-09-16 — Discovery happens on the board (Design Round 3, step 1)

Built the first recommendation of [[README|Design Round 3]].
- **On the board.**
  - Trail wedges mark the squares of a line in progress.
  - On discovery the route is traced, entrance to end, with a light sweeping the board's edge; it lasts
    about a second and never covers the board.
  - A mote flies into the counter. Under reduced motion the edge lights once, still.
- **Under the board.** A variation shelf with the line counter: segment width = lines, lit = discovered,
  warm = entered, fog = secret. Single-line variations fold into "Sidelines".
- **Critique fixes.**
  - The line card always keeps its place, including an idle "In the book / Past the known lines" state,
    so buttons never jump.
  - The notice title no longer contradicts its text: it says "Your move", and position context lives
    in the card.
  - Sentence-case kicker.
  - "Still secret" is no longer repeated per variation.

Still to do from Round 3: ~~the fog-of-war line map~~ (built, below), and the picker spines.

## 2026-09-16 — The line map

- **Layout is a pure module** (`src/lib/explore/linemap.ts`: bands, trie, tidy placement, edge states),
  rebuilt wholesale on every change rather than diffed: a few milliseconds even for the Sicilian, and
  it is unit-tested against the real bundle for the ≤ 2,000-element budget.
- **An entered line's end stays secret.** The prototype named entered ends with their entrance name; the
  built map draws a hollow warm end and no name, and writes moves only on edges the learner has played.
  What the learner hasn't reached must not be readable off the map.
- **Discovered lines are lit end to end**, not just past the entrance: every edge of a discovered line was
  played. The prototype's muted "known" trunk was dropped.
- **Overlay, not a board swap.** The map opens over the page (a bottom sheet on phones) so the Explore page's
  layout is untouched and the component stays self-contained. It is built only while open.
- **Dubious lines get a band** at the bottom rather than being hidden, consistent with the page's separate
  "Dubious lines" list.

## 2026-09-16 — Today session; Why? becomes a question

- **`/today`.** Due lines across all openings, interleaved, capped at 10, with a "done" state and no
  streaks. It is the daily surface spaced review needs.
- **Why?** The learner plays the refutation from the opponent's side, then watches the engine line play
  out.

Both come from [[Learning science for opening training]] (P2, P3). See [[Exploration Mode]].

## 2026-09-16 — Practice becomes line review (FSRS over discovered lines)

The overnight research ([[Learning science for opening training]]) ranked line mastery first: a
discovered line was never asked again. Practice now replays discovered lines from memory. It starts at a
random point, with the name hidden; a sound move from another line counts as Hard, a miss or the arrow as
Again. FSRS state is derived from an append-only `line_reviews` log (migration 0003). Admin "active
learners" now counts discoveries and line reviews too, since exploring records no attempts. The old
single-move tree Practice is retired from the UI. Details in [[Exploration Mode]].

## 2026-09-16 — Line card anticipates, then celebrates; no evaluation while learning

- **The card follows the line.** Per the user, it anticipates a line from its entrance, with progress
  pips, and celebrates when the final move is reached, whichever side plays it. One-move lines celebrate
  immediately. See [[Exploration Mode]].
- **No evaluation on the opening page.** The eval bar and number are removed at the user's request:
  relative strength distracts while learning, and it belongs in a future analysis mode. The play page
  keeps its bar.
- **Deployed.** Exploration, the audit fixes and this card went live together. Remote D1 migration
  0002 was applied by the user, and I verified it (`discoveries` table present, no pending migrations).

## 2026-09-15 — Soundness audit fixed

[[2026-09-15 — Fable soundness audit]] found 9 issues (1 high, 3 medium, 5 low); all are fixed.
- **Repetition cycles.** The builder now removes edges back into the current path (`breakCycles`). The
  King's Indian and French bundles had loops, and a first King's Indian walk never ended. Practice walks
  also end on a finished game or a repeated decision, and `bundles.test.ts` checks every shipped bundle.
- **Sync queue.** The outbox uploads in batches of 500. A row the server rejects is dropped: it is named
  in the error, or found by halving the batch. A 401 stops retrying and shows "session ended". The first
  pull times out after 8 s.
- **Sign-out** no longer deletes unsent progress. It asks first, and keeps only the outbox so the rows
  upload at the next sign-in.
- **Scheduler** clamps reviews stamped in the future, which used to make ts-fsrs throw and the card
  unpassable. Response times are clamped at ≥ 0. Cards are scheduled after the move is played.
- **Free play** scores checkmate and draws from the result.
- **Engine** fails fast after `destroy`, and pages ignore that one rejection.
- **Request bodies** are read in chunks with a byte cap.
- **Adoption** merges the server copy first and dedupes attempts.
- **wrangler:** `workers_dev: false`, `preview_urls: false`.

## 2026-09-15 — Exploration replaces Learn

The user rejected arrow-led Learn in favour of active learning: established lines are secret and the
learner discovers them. The design and definitions are in [[Exploration Mode]]. Key choices:
- **Line.** A catalog leaf under the defining moves.
- **Stages.** *Entered* at the deepest named position before the end, *discovered* at the end.
- **Dubious lines** (a learner move losing ≥ 0.2 win chance) are counted separately.
- **Try again / Play on** only for mistakes off the book.
- **Book replies** steered toward undiscovered lines and discounted when unsound.
- **Hints.** A line found through an arrow hint doesn't count.
- **Storage.** D1 `discoveries` table (migration 0002). Local D1 had no migration history, so 0002 was
  applied with `d1 execute`. Check the remote history before deploying.

Bundles grew by every book position (≤ 575 KB, Sicilian); `pipeline/tsconfig.json` maps `$lib` so the
pipeline can share `judge.ts`.

## 2026-09-15 — Analytics, admin stats, privacy contact; the "stale cache" that was Dark Reader

- **Cloudflare Web Analytics** (cookieless) injected by `hooks.server.ts` on the canonical host only;
  CSP allows `static.cloudflareinsights.com` / `cloudflareinsights.com`. Real-visitor numbers live there,
  not in DNS/traffic tabs (bots, certificate-log scanners and our own testing dominate those).
- **`/admin`** — aggregate learner stats (accounts, active learners, moves per day, top openings), 404 for
  everyone except `gandolphius@gmail.com` (`src/lib/server/stats.ts`).
- **Privacy contact `privacy@lethalchess.com`** via Cloudflare Email Routing → gandolphius@gmail.com.
  Required deleting Porkbun's forwarding MX/SPF records (user did); test email verified delivered.
  Privacy page rewritten: controller contact, analytics, processors, legal basis, retention, rights, IMY.
- **Never serve stale versions:** pages sent `Cache-Control: no-cache`; `version.pollInterval` makes open
  tabs detect deploys and offer a reload.
- **Lesson:** "production shows old pieces, private window is correct" was the **Dark Reader** extension
  recolouring SVG outlines (extensions are off in private windows). Proven by rendering production and
  localhost byte-identical, then a console diagnostic from the affected window. Fix: `<meta
  name="darkreader-lock">` + `color-scheme` meta so extensions and forced dark modes leave the site's own
  themes alone. Check for colour-altering extensions *first* next time appearance differs per window.

## 2026-09-15 — Live on lethalchess.com (Cloudflare Worker, EU D1)

The app replaced the Coming Soon page at 21:47. Setup, in the Cloudflare account that owns the zone
(a GitHub-login account — the first `wrangler login` went to a different, email-based account that
had no zone; nothing was created there):

- **D1 `lethal-chess` with `--jurisdiction eu`** — verified via API (`jurisdiction: eu`, running EEUR).
- **Secrets** `GOOGLE_CLIENT_ID/SECRET` via `wrangler secret bulk` from `.dev.vars`, never printed;
  the temp JSON was shredded.
- **Custom domains** `lethalchess.com` + `www.lethalchess.com` on the Worker; `www` 301-redirects to the
  apex in `hooks.server.ts` (sessions and the OAuth callback live on one host).
- **Cutover:** detached both domains from the `pre-lethalchess` Pages project; the Worker attach then
  failed because the Pages-era CNAME records still existed (wrangler's OAuth token has no DNS scope). The
  user deleted them in the dashboard; redeploy attached both. Downtime ~5 min. Rollback path: re-attach
  the domains to the Pages project.
- **Production-only bug found and fixed first on workers.dev:** SvelteKit's server-side `fetch` of a
  static path returns 404 inside the Worker (static files sit in the assets layer in front of it). Loads
  now use the `ASSETS` binding in production and Vite's fetch in dev (`src/lib/server/assets.ts`).

Verified on the live domain: all routes, 404/401 behaviour, TLS, www redirect with path and query, the
Google redirect URI. **Not yet verified: a real Google sign-in end to end** — needs the user.

## 2026-09-15 — Public source on GitHub, not Codeberg

AGPL requires public source. The user suggested Codeberg (`dafroggy`), but Codeberg's terms of use
(§7, adopted 2026-07-23 by member vote) forbid sharing "projects that mostly consist of code written by
'generative AI'-tools (including services such as Claude…)" — which this project is. A public Codeberg
repo could be removed, taking AGPL compliance with it. (Private Codeberg repos remain fine, consistent
with the system vault's earlier reading.)

Published at **github.com/gandolphus/lethal-chess** (public, AGPL-3.0 detected by GitHub), first
commit `af7b084`. The vault is public too — scanned first: no emails, keys or tokens; temp paths
scrubbed. Commits use GitHub's no-reply address (repo-local config) so no email is exposed. Before the
push, a secret scan ran over exactly the 246 committed files; `.dev.vars`, `data/`, `static/engine/`
verified gitignored.

## 2026-09-15 — Open source under AGPL-3.0; Stockfish ships in the browser

**Reverses** "no browser engine" from the Public MVP entry below, the same evening. The user wants
coached play past the end of a line ([[Coached Free Play]]): grading any move, natural computer replies,
planted mistakes. That needs an engine that can evaluate *arbitrary* positions live; Lichess cloud eval
covers only already-analysed positions and fails a few moves after a deviation.

Options were browser engine + publish source (AGPL) or server engine + closed source. User:
"engine in the browser for now with the open source license for sure." Chosen for instant response,
zero server cost, offline capability, and speed to ship. `LICENSE` is the official AGPL-3.0 text;
`package.json` declares `AGPL-3.0-or-later`. Consequences: cburnett (GPLv2+) is usable publicly;
[[Engine licensing]] is resolved; a closed paid tier is off the table unless this is revisited.

**Still to do before public launch:** a public source repository and a visible "Source" link (AGPL §13).

## 2026-09-15 — OAuth without Arctic: vendored Google flow on fetch + Web Crypto

Arctic and most `@oslojs/*` packages were deprecated by their author on 2026-07-29 (his blog post; the
repository's `/code` examples are the recommended replacement). Verified the deprecation was deliberate,
not a compromise. Auth is security-critical, so no unmaintained dependency: `src/lib/server/google.ts`
implements state + PKCE (S256 checked against the RFC 7636 test vector), token exchange (no redirect
following, 10 s timeout), and ID-token claim checks. Hand-rolled database sessions (SHA-256-hashed
tokens, 30-day sliding) unchanged. See `src/lib/server/CODEX.md`.

## 2026-09-15 — Engine analysis collects multi-PV per depth

Verified against the real WASM engine in Chromium: a search stopped by movetime mid-depth mixes ranks
from two depths and can list the same move twice (seen: `Nc3` at ranks 4 and 5). `MultiPvCollector`
keeps lines per depth and returns the deepest *complete* set, deduplicated. A unit test reproduces the
real output.

## 2026-09-15 — Audit #2 fixes: drill trees end on learner decisions

[[2026-09-15 — Fable correctness audit 2]]: the builder stopped at its card budget leaving replies that
pointed at unexpanded positions, so 55–99% of drill walks ended right after an opponent move with no
decision asked. Fix: `pruneDanglingReplies` — replies must lead to a learner decision, weights
renormalised, unreachable nodes removed. **Re-running the audit's own 20,000-walk simulation: 0.0%
dangling, 3–10 decisions per walk (mean 5.3–6.3).** Also fixed: duplicate PVs from the eval db
(deduplicated in the builder), sound engine replies now seated before thin catalogued theory,
coverage counts first-try passes only, per-attempt response time, and three tests that would have
passed on broken code.

## 2026-09-15 — 28 launch openings; the index is generated

User: "all the popular ones and some not so popular ones if they have potential, or are especially
aggressive." `pipeline/repertoire/spec.ts` now lists 28 (13 White, 15 Black) with groups and tags
(popular / aggressive / gambit / system / solid). The builder writes `repertoires/index.json` — the
single list the app reads (the hand-maintained `launch.ts` duplicate is gone). Budget raised to 180
learner decisions, maxPly 22. Less popular lines have more positions without cached evals (up to 72,
London System) — a native-Stockfish fallback in the pipeline ([[Off-book Practice]] needs it too) would
deepen them.

## 2026-09-15 — Public MVP on lethalchess.com: Cloudflare Workers + D1, no browser engine

User direction: "Build an MVP where a novice can start practicing pretty well, with a database and
Google auth so data is saved… put it on lethalchess.com… send a link to a friend and have them
practice the Ruy Lopez." Scope: [[Public MVP]].

**Architecture — analysis is offline, the site does no chess computation:**
1. *Offline, locally:* the pipeline precomputes every tree position's candidate moves, evals,
   engine lines, names and sharpness → static per-opening bundles.
2. *Browser:* the whole drill. Grading a move is a lookup in the bundle. Moves outside the data
   are still gradeable (worse than every stored candidate). Free exploration past the data can call
   Lichess cloud eval directly — **verified `access-control-allow-origin: *`**.
3. *Cloudflare:* static site + bundles on the CDN; a small Worker for Google sign-in, sessions and
   the attempt log; **D1** (SQLite, 30-day point-in-time recovery) for storage.

**Hosting: Cloudflare Workers + D1** over a VPS — the domain is already on Cloudflare (verified:
serving the "Coming Soon" page), zero servers to maintain. **Supersedes** "Persistence is SQLite on
disk via the SvelteKit server": that was right for a local tool, not a hosted multi-user one. The
append-only attempt log and derive-everything principle carry over unchanged; only the engine changes.

**No Stockfish in the public app.** Drills never needed it; only play-vs-computer does. Shipping
GPL-3.0 WASM publicly would oblige publishing source ([[Engine licensing]]); launching without it
keeps that decision open. Play-vs-computer stays in local builds.

**Launch openings (default, user may extend):** Ruy Lopez and Italian Game (the novice entry point)
plus the user's English, Sicilian and Caro-Kann.

## 2026-09-15 — Full eval cache built and validated

129,235,757 positions (≥ 26 pieces) from 409,710,113 lines, **8.27 GB, 12.5 min**, 0 duplicates,
0 malformed. **Coverage of all 7,855 catalog positions: 99.5%** — 100% through ply 17, 98% at 18–19,
92% at 20. 84.5% of hits carry ≥ 3 candidate moves, 80.1% depth ≥ 30. All 831 king-takes-rook
castling moves are legal after normalisation. King's Gambit spot check agrees with cloud eval.
Report: `node pipeline/eval-cache/coverage.ts`. Raw 22 GB kept until the tree builder is proven,
then deleted.

## 2026-09-15 — Precision first; rating-based strategy goes to the bottom of the backlog

User direction: "Forget about my rating. We're doing a serious tool first and foremost, not a hacky
one. I want to get super proficient first." The first rollout is built on **objective engine truth
only**. Everything keyed to a rating band — practical edge, "what players at your level get wrong",
frequency by band — is deferred indefinitely ("maybe").

Consequences:
- The **30 GB game dump is not needed** for the first rollout. The **22 GB eval db is**.
- "Common responses" can no longer mean "frequent at your band". Replaced by
  **engine-sound replies ∪ catalog-named replies** — the catalog lists the dubious-but-real lines
  people actually play (Wing Gambit, Morra, …), which covers what a frequency filter would have
  caught, without any rating assumption.
- The strength model in [[Opening Classification]] keeps *objective cost* and drops *practical edge*
  for now.

## 2026-09-15 — Repertoires organised as catalog-named tracks, not one chosen line

Repertoires: **English (White), Sicilian (Black), Caro-Kann (Black)** — the user wants proficiency
in "all aspects", especially the aggressive English lines and those demanding the most precision from
the opponent.

Rather than forcing an upfront choice ("which Sicilian?"), each named catalog line is a **track**
(`Sicilian Defense: Najdorf Variation, English Attack`), and names give a family hierarchy for free
(Sicilian → Najdorf → English Attack). Tracks are what you choose to study and what proficiency is
measured on. See [[Opening Drills]] and [[Progress Tracking]].

**"Most precision demanded from the opponent" is computable**: at each opponent-to-move position,
how many moves stay within tolerance of best, and how far the second-best falls. The eval db stores
5 candidate lines for most opening positions, which is exactly this. **"Aggressive" is not directly
computable** — approximated by that sharpness score, refined by hand-tagging. Stated plainly so
nobody mistakes the proxy for the thing.

## 2026-09-15 — Moves graded by eval, not just match/no-match

Your repertoire move = pass. A different move within tolerance of best = **soft result**
("sound, but not your line" — shown, not failed). Anything else = fail, with the centipawn cost and
the engine line. A precision tool should distinguish "wrong" from "different", and the eval db makes
it free.

## 2026-09-15 — Persistence is SQLite on disk via the SvelteKit server

Reverses "no backend" for one reason: the user requires **reliable** progress tracking. Browser
storage is per-browser, evictable, and invisible to backups; a SQLite file is none of those.
Using Node 24's built-in **`node:sqlite`** (verified working, no flag, no native build — so no
repeat of the [[pnpm]] install-script trouble).

The attempt log is **append-only** (card, time, move played, expected, grade, cp loss, response time);
scheduling state (FSRS) and proficiency are *derived* from it. So the scheduling algorithm or the
proficiency formula can change later and be recomputed over full history — nothing is lost to an
early design mistake.

## 2026-09-15 — Eval data: stream once, keep a temporary cache, discard

One streamed pass over the eval db, keeping positions with ≥ 26 pieces (the opening phase) as a local
cache: measured ~14 min single-thread at ~490k lines/s, est. **5–17 GB depending on encoding**.
Enough to expand all three repertoire trees *and* all 3,810 catalog openings without re-streaming.
The raw 22 GB file is never stored. The cache is deleted once the shipped bundles are built, per the
user: "discarded as soon as they've outlived their use". Details in [[Data sources]].

## 2026-09-15 — Lethality is back in scope, rebuilt from real data

Reverses part of "Scope narrowed to a drilling tool" below, the same day. The user's goals now
include classifying every opening by strength and drilling its weaknesses — which *is* the lethality
pipeline. Drilling stays the product; classification becomes the content it drills.
See [[Opening Classification]] and [[2026-09-15 — Fable design review]].

**`scoring.py` is not ported.** The review showed, and we confirmed at `aggregate_store.py:305`,
that all five factors of the old formula were derived from one number — the mover's score rate.
"Engine soundness" was `(score_rate − 0.5) × 420`, not engine output. The replacement keeps
objective cost (real evals) and practical edge (Elo- and colour-corrected results by band) as
**two separate numbers**, never blended by fixed weights.

## 2026-09-15 — Classification is an offline native build; the app ships static data

Analysis runs offline with native [[Stockfish]] + python over the Lichess game dump and eval db,
not in the browser — WASM is ~10× slower with no parallelism. Output is per-opening JSON bundles,
lazily loaded; still no backend. All three data sources are **CC0**; the explorer API is not
crawled. Offline engine use is not distribution, so the shipped data carries no GPL obligation.
See [[Data sources]].

Positions are keyed by **EPD** (FEN minus move counters) so transpositions share stats and cards;
opening names live on paths, not positions.

## 2026-09-15 — Opening catalog imported and validated at build time

`scripts/build-catalog.js` fetches `lichess-org/chess-openings` and replays all 3,810 lines through
[[chess.js]], failing the build on any mismatch — the review flagged SAN drift between catalog and
rules engine as a risk, so it is caught at build time rather than mid-drill. Output
`static/openings/catalog.json` is committed (derived data, reproducible via `pnpm catalog:build`).

## 2026-09-15 — Engine commands are serialised; results carry their FEN

A Fable 5.1 audit found that a new game started mid-search could receive the *old* search's move
(details in [[Play vs Computer]]). The underlying fact: the Stockfish worker queues `go`/`setoption`
behind a running search but runs `position`/`isready`/`ucinewgame` immediately, so any caller that
interleaves commands silently corrupts state.

Decision: `Engine` owns that problem, not its callers. Every state-touching operation goes through
one serial lock; `bestMove()` returns `{ fen, move }` so a caller can always check the result still
applies. Callers additionally keep a generation token. This matters more for [[Opening Drills]]
than for play — drills jump positions constantly, so the bug would have been routine, not rare.

## 2026-09-15 — Scope narrowed to a drilling tool

The product is **a tool for drilling openings**, not the "Chess Lethality Visualizer" described in
`../pre-lethalchess`. The lethality premise (train against *human* failure patterns, not engine
best-play) survives as the eventual differentiator, and the FastAPI + Lichess ingestion pipeline in
`../chess-lethality-analyzer` is left intact to be pulled back in later. See
[[Lineage — from lethality analyzer to drilling tool]]. Building the daily-useful thing first.

## 2026-09-15 — SvelteKit over React

Considered React 19 (continuity with the analyzer prototype, `react-chessboard`, react-three-fiber)
against SvelteKit. Chose **SvelteKit + Svelte 5 runes** because:

1. **Built-in server layer.** Drilling needs persistence and eventually the Lichess failure-rate
   data. SvelteKit gives routing + server endpoints in one thing; the React path means React Router
   plus a separate backend, which is exactly what the old prototype did.
2. **Less ceremony for state machines.** A drill *is* a state machine
   (present → await → judge → feedback → advance). Runes express that without
   `useEffect`/`useCallback`/dependency arrays; worker lifecycle especially.
3. Smaller runtime, scoped CSS.

**Explicitly not a factor: rendering performance.** A 64-square board is nothing; VDOM overhead here
is unmeasurable. Rejecting React on "no virtual DOM" grounds would have been a non-reason.

**What we gave up:** react-three-fiber. If the tree visualization ever wants declarative 3D, Svelte's
Threlte is smaller-ecosystem. Judged acceptable — see the next entry.

## 2026-09-15 — Graphics stay framework-agnostic

Asked whether shaders/WebGL later would favour React. Conclusion: **no — shader work happens outside
the framework either way.** You mount a canvas, hand it to a renderer, and keep the framework away
from it.

Therefore the rule: any future render layer ships as a **plain TS module with a
`mount(canvas, opts) → { update, destroy }` API**, exactly like [[Stockfish]] and [[chess.js]] are
today. The framework wraps ~20 lines around it. This keeps the SvelteKit decision cheap to reverse
and is why `src/lib/chess/*` imports nothing from Svelte.

Corollary: the board is **DOM/SVG now, WebGL overlay canvas later** — not WebGL from day one.
Crisp text, trivial hit-testing, effects composite on top.

## 2026-09-15 — Hand-rolled board, not a library

`Board.svelte` is ~250 lines of our own: 8×8 grid, click-to-move + pointer drag, legal-target dots,
last-move and check highlights, promotion picker. Rejected `react-chessboard` (wrong framework once
SvelteKit was chosen) and chessground (Lichess's own, framework-agnostic, genuinely good).

Reason: the drill UI is going to need overlays chessground doesn't model — correct/wrong flashes,
masked squares, hint arrows tied to drill state. Owning the board means those are props, not
fights with a library. **Revisit if** premoves or serious animation become priorities; chessground
has years of polish there that we do not.

## 2026-09-15 — Stockfish 18 *lite/single-threaded* WASM

Using the lite single-threaded build (7 MB) rather than the full one (113 MB) or the
multi-threaded one. Multi-threaded needs `SharedArrayBuffer`, which needs COOP/COEP cross-origin
isolation headers — a deployment constraint we do not want to inherit for an opponent that only has
to play at club strength. `scripts/sync-engine.js` copies it into `static/engine/` (gitignored);
pnpm's `allowBuilds: stockfish: false` in `pnpm-workspace.yaml` suppresses the package's own
postinstall, which only symlinks the 113 MB build we are not using.

Difficulty maps to `UCI_LimitStrength` + `UCI_Elo`. **Stockfish refuses Elo below 1320**, so
"Beginner" is 1320 — a genuine floor, not a chosen one. Going weaker needs `Skill Level` or
deliberate move corruption.

## 2026-09-15 — Engine licensing flagged, not resolved

`stockfish` npm is **GPL-3.0**, and shipping WASM to a browser is distribution. A closed or paid
tier built around it is legally awkward — this is why Lichess is AGPL. Options: keep the whole app
GPL (fine while it is a personal tool), move the engine server-side behind an API, or swap to a
permissively-licensed engine. **Not blocking a local drilling tool. Must be settled before anything
commercial.** See [[Engine licensing]].

## 2026-09-15 — Project scaffolded with `forge`

Created the repo, this Obsidian planning vault (`lethal-chess-vault`, Catppuccin Mocha), and the
initial skeleton.
