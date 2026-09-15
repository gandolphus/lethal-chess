---
tags: [moc, system-map]
aliases: [Architecture, System Map]
---

# System Map · lethal-chess

Source of truth for **what exists and why**. See [[Decision Log]] for rationale and [[Home]] for vision.
Rewritten 2026-09-15 after [[2026-09-15 — Fable soundness audit]] found the old map still described the
pre-drill MVP.

## Stack

| Layer | Choice | Note |
|---|---|---|
| Framework | [[SvelteKit]] 2 + Svelte 5 (runes) | Runes forced on in `vite.config.ts` |
| Language | TypeScript | The pipeline runs on Node 24 type stripping |
| Build / test | Vite 8, vitest | `.claude/**` (agent worktrees) excluded from tests |
| Rules engine | [[chess.js]] 1.4 | Legal moves, SAN/FEN, mate/draw detection |
| Chess engine | [[Stockfish]] 18 lite, single-threaded WASM | Web Worker, UCI, serial command lock; loaded only when needed |
| Scheduling | ts-fsrs (MIT) | Practice cards |
| Hosting | Cloudflare Worker (`adapter-cloudflare`) | `lethalchess.com` + `www`; workers.dev and preview URLs off |
| Database | Cloudflare D1, EU jurisdiction | Migrations in `migrations/` |
| Auth | Google OAuth, vendored (fetch + Web Crypto) | State + PKCE; DB sessions with hashed tokens |
| Styling | Plain scoped CSS, design tokens | 15 themes, 8 piece sets ([[Visual Design]]) |

## Directory layout

```
src/
  hooks.server.ts             Canonical host/HTTPS redirects, session, security headers, cache-control, analytics
  lib/
    chess/                    engine.ts (Stockfish wrapper), game.svelte.ts (reactive chess.js)
    components/               Board.svelte (own board: drag/click, marks, arrows, promotion), Piece.svelte
    coach/                    judge.ts (win-chance verdicts), opponent.ts (natural replies + planted
                              mistakes), freeplay.svelte.ts (coached play from any position)
    explore/                  book.ts (established lines by position, discovery summary),
                              session.svelte.ts (ExploreSession), mastery.ts (FSRS per line from the review log),
                              review.svelte.ts (ReviewSession: Practice) — see [[Exploration Mode]]
    drill/                    bundle.ts (bundle format, shared with the pipeline), session.svelte.ts
                              (Practice walks), grade.ts, tree.ts, scheduler.ts (FSRS),
                              progress.ts / synced-store.ts / server-store.ts / account.svelte.ts (progress storage)
    server/                   google.ts, session.ts, users.ts, progress.ts, account.ts, stats.ts,
                              validate.ts, http.ts, assets.ts (static files via ASSETS in production)
    theme/                    Themes and piece sets, settings persistence
    ui/                       EvalBar, Meter, MiniBoard, position helpers
  routes/
    +page.svelte              Opening picker
    openings/[id]/            Explore / Practice page
    play/                     Play vs computer
    settings/, privacy/, credits/, admin/ (owner only)
    auth/google/…, api/progress, api/attempts, api/cards, api/account/{export,delete}
pipeline/
  eval-cache/                 Lichess eval db (CC0) → 8.27 GB lookup cache (build artefact, not shipped)
  repertoire/                 spec.ts (28 openings), build.ts (practice tree + book lines),
                              bundles.test.ts (checks the shipped bundles), inspect.ts
migrations/                   0001 users/sessions/attempts/cards, 0002 discoveries, 0003 line_reviews
static/openings/              catalog.json (3,810 named lines), repertoires/*.json (one bundle per opening)
lethal-chess-vault/           This vault
```

## Data flow

**Offline.** `pipeline/repertoire/build.ts` reads the eval cache and the opening catalog and writes one
bundle per opening. A bundle holds:
- the practice tree: one learner move per decision, weighted opponent replies, repetition cycles removed;
- every catalog **book line** under the opening's defining moves, each with an entrance, an end and a
  dubious flag;
- engine candidates for every position involved.

**In the browser.** The opening page loads its bundle.
- **[[Exploration Mode]]** (`ExploreSession`) grades moves from the bundle while in book, answers with
  book replies steered toward undiscovered lines, and falls back to Stockfish past the book. It reports
  lines entered and discovered.
- **Practice** (`ReviewSession`) replays discovered lines from memory, scheduled per line with FSRS derived
  from the review log. The old tree walk (`DrillSession`) is retired from the UI.
- **[[Coached Free Play]]** (`FreePlay`) continues from any position with the engine.

**Progress.** Local-first. Every write lands in localStorage at once:
- **Signed out:** that is the only copy.
- **Signed in:** an outbox uploads in batches of 500 through `/api/progress/import`. The import is
  idempotent, rows the server rejects are dropped instead of blocking the queue, and a 401 stops retries.
  Each opening's server copy is merged in once per page load, with an 8 s timeout.

**The layering is the point.** `engine.ts` and `game.svelte.ts` know nothing about Svelte components,
and `Board.svelte` knows nothing about the engine or the drill. Sessions are policies over a `Game`.

## Data model (D1)

- `users`, `sessions` (id = SHA-256 of the cookie token)
- `attempts` — append-only Practice moves; natural key `(user, bundle, at, epd, attempt_no)`
- `cards` — FSRS state per practice position, derived from attempts
- `line_reviews` — `(user, bundle, line, at)`, rating again / hard / good; line FSRS state is replayed from it
- `discoveries` — `(user, bundle, line, stage)`, with `stage` either `entered` or `discovered` and `line` the
  EPD of the line's end; first time kept

Account export and delete cover every table.

## Known gaps

- Board has `role="application"` and no keyboard support.
- Moves do not animate between squares.
- The retired tree Practice (`DrillSession`, `grade.ts`, `tree.ts`, `cards` table, bundle practice trees) is
  still in the code and data; prune once line review has proven itself.
- No rate limiting on the API ([[Public MVP]] backlog).
