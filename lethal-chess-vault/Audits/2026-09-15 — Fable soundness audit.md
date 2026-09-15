---
tags: [audit, code, fable, security]
aliases: [Fable soundness audit]
---

# 2026-09-15 — Fable 5.1 soundness audit

Read-only audit of `main` (f7e9969) for real bugs and unsafe operations across auth, the progress
APIs, sync, the drill and [[Coached Free Play]], the engine wrapper and the repertoire pipeline.
Follows [[2026-09-15 — Fable code audit]] and [[2026-09-15 — Fable correctness audit 2]]; their fixes
were re-checked and still hold (see § Verified fine). `pnpm test` (221) and `pnpm check` pass.

Evidence: every finding was traced through the code and, where marked, reproduced with scratch
scripts (bundle graph checks over all 28 shipped bundles, 20,000 simulated walks per bundle, the real
Stockfish 18 lite build, ts-fsrs 5.4.2 against the server validator, a vitest repro of the outbox).

| # | Sev | Status | Finding |
|---|---|---|---|
| 1 | high | CONFIRMED | Two shipped bundles contain repetition cycles; the King's Indian's first Learn walk never ends |
| 2 | medium | CONFIRMED | One row the server rejects poisons the outbox forever; every later attempt stops syncing and the UI says "offline" |
| 3 | medium | CONFIRMED mechanism, PLAUSIBLE trigger | A card reviewed "in the future" (clock skew ≥ 1 day) makes ts-fsrs throw inside `submit`; the card becomes unpassable |
| 4 | medium | CONFIRMED | Sign-out deletes unsent progress after a 3-second race, silently |
| 5 | low | CONFIRMED | Free play grades a checkmating move outside the top-6 lines as 0.00 — undone as a "missed opportunity" when one is pending |
| 6 | low | CONFIRMED | `readJson` buffers the whole body before enforcing the size cap when Content-Length is absent |
| 7 | low | CONFIRMED | Unhandled rejections and a hung `FreePlay` after the engine is destroyed on navigation; the first pull has no timeout |
| 8 | low | PLAUSIBLE | Sign-in adoption races the per-bundle merge; two tabs can duplicate local attempts |
| 9 | low | PLAUSIBLE | `workers_dev` not disabled: the Worker may answer on a second origin |

---

## 1 · Repetition cycles in shipped bundles — the King's Indian's first walk never ends

**high · CONFIRMED** · `pipeline/repertoire/build.ts:227`, `pipeline/repertoire/build.ts:136-156`,
`src/lib/drill/session.svelte.ts:159-180`

The builder keys nodes by EPD and treats *any* already-seen position as a transposition
(`if (nodes[epd]) continue;` at build.ts:227). A position reached again by shuffling pieces back is
also "already seen", so the graph gets a back edge. `pruneDanglingReplies` only removes replies that
lead nowhere; it never breaks cycles. On the client, `DrillSession.#advance` follows `move`/`replies`
until a node has neither, and ignores `game.isOver` — threefold repetition does not end a walk.

A DFS from each bundle's root finds a reachable cycle in two of the 28 bundles:

- **kings-indian** — *Petrosian Variation, Normal Defense* (ply 14): replies `Be3=0.50 Qc2=0.25 Bg5=0.25`
  → learner `Ng4` → node at ply 16: replies `Bc1=0.55 Bg5=0.27 Bd2=0.18` → learner `Ngf6` → back to
  the Petrosian node. `Be3` and `Bc1` are both the *highest-weighted* reply at their node, and a
  first-ever walk is `guided` (`+page.svelte:70` → `session.svelte.ts:184` picks the max weight), so
  **a new learner's first Learn walk of the King's Indian is `Be3 Ng4 Bc1 Ngf6 Be3 Ng4 …` forever.**
  Simulated: guided walk never terminates; 2.44 % of later (sampled) walks revisit a card before ending.
- **french** — node `r1b1kb1r/pp3ppp/1qn1p3/3pPn2/3P4/2N2N2/PP2BPPP/R1BQK2R w` (ply 16): the only
  reply is `Na4=1.00` → learner `Qa5+` → only reply `Nc3=1.00` → learner `Qb6` → same position. Once
  entered, this cycle is forced. Simulated: 0.86 % of walks never end.

**Failure scenario.** A learner picks the King's Indian for the first time, clicks Learn, plays the
arrows. After move 9 the computer plays Be3, they play Ng4, it plays Bc1, they play Ngf6, it plays
Be3… "Line complete" never appears, "Keep playing" is never offered, and in Practice mode each pass
re-schedules the same two cards seconds apart (FSRS reviews with `elapsed_days = 0`, inflating
`reps`). Audit #2's open item 8 (`cardsBelow` memo inside cycles) is now live for these two bundles.

**Fix.**
- Builder: after `pruneDanglingReplies`, DFS from the root and drop every reply whose target is an
  ancestor on the current path (renormalise weights; a node left with no replies becomes a line end,
  like the dangling case). Assert the result is acyclic and add it to `build.test.ts`; re-run the
  bundle check that produced these numbers as a test over `static/openings/repertoires`.
- Client safety net: in `#advance`, end the walk (`phase = 'done'`) when `this.game.isOver` or when
  the learner node's EPD was already asked in this walk.

## 2 · One rejected row poisons the outbox forever

**medium · CONFIRMED (vitest repro)** · `src/lib/drill/synced-store.ts:112-140`,
`src/routes/api/progress/import/+server.ts:8-16`, `src/lib/server/validate.ts:68`

`#upload` sends the *entire* outbox as one `importProgress` call and, on any error, increments
`#failures`, reports `offline` and schedules a retry. Nothing distinguishes a network failure from a
4xx, and the import is all-or-nothing (`parseList` throws on the first bad item), so a single row the
server will never accept blocks every row queued behind it, permanently. The UI reads
"Can't reach the server — progress is kept on this device and will sync" while the server is fine.

Repro (fake server answering 400 for one attempt with `responseMs: -5`): after ten retry rounds the
outbox still holds all 4 attempts, status is `offline`, another retry is scheduled.

Ways a row becomes unacceptable:
- `responseMs < 0` — `#awaitingSince` and `#now` are wall-clock (`session.svelte.ts:153,211`); an NTP
  step backwards mid-card yields a negative value, rejected by `validate.ts:68`.
- Adoption enqueues all signed-out history in one batch (`synced-store.ts:233`); over 20,000 attempts
  or 8 MB (`import/+server.ts:8-16`) → 400/413 forever. The server comment says "larger histories can
  be sent in several calls", but the client never chunks.
- 401 after the account was deleted or signed out elsewhere: retried forever as "offline".
- Any future tightening of server validation.

**Fix.** Treat 4xx (other than 401/429) as permanent: the error message already names the offending
index (`attempts[i]: …`) — drop that item and retry the rest, or move it to a quarantine key. On 401
stop retrying and surface "signed out". Chunk uploads (e.g. 500 attempts / 500 cards per call).

## 3 · A card with a future `last_review` makes `submit` throw; the card cannot be passed

**medium · CONFIRMED mechanism, PLAUSIBLE trigger** · `src/lib/drill/scheduler.ts:19-21`,
`src/lib/drill/session.svelte.ts:140-147`, `src/lib/drill/synced-store.ts:30-31,183`

ts-fsrs 5.4.2 throws `FSRSValidationError: Invalid delta_t "-1"` from `next()` when `now` is a day or
more before `card.last_review` (verified: 12 h behind is fine, 23 h+ throws). `DrillSession.submit`
calls `#schedule` (→ `review`) *after* recording the attempt (`:140`) and *before* `game.move`
(`:145`). So on a pass: the attempt is logged as `pass`, the squares flash green, `submit` rejects
(unhandled — `Board.onMove` ignores the promise), the move is never played, the phase stays `await`,
and every further pass on that card throws the same way. In Learn mode too. `recall()` is unaffected
(`get_retrievability` clamps), so the proficiency panel keeps working.

**How a card gets a future `last_review`.** (a) The device's clock was ahead by a day or more during
some reviews and was later corrected — every card reviewed in that window is now unpassable until the
real clock catches up. (b) Another device with a fast clock reviewed the card; the merge takes the
remote card as "newer" (`newer()` compares `last_review`) and imports the future timestamp.

**Fix.** In `review()`, clamp: `const at = state?.last_review && now < state.last_review ? state.last_review : now`
(and log/ignore the skew), or catch `FSRSValidationError` and fall back to scheduling from a fresh
card. Independently, move `#schedule` after `game.move` and wrap it, so a scheduler error can never
freeze a walk.

## 4 · Sign-out deletes unsent progress after a 3-second race

**medium · CONFIRMED** · `src/routes/+layout.svelte:26-42`, `src/lib/drill/synced-store.ts:107-125`

`clearLocalAccountData` races `store.flush()` against a 3 s timer, then removes every
`lethal:user:<id>:*` key — including `…:outbox`. `flush()` never rejects: a failed upload resolves
after scheduling a retry. So if the server is unreachable, slow, or the outbox is poisoned (#2), the
outbox is deleted with no warning and the attempts/reviews it held are gone from every copy. A
concurrent drill tab keeps writing under the same keys after the loop, so the cleanup is also not
complete on a shared machine.

**Failure scenario.** Drill offline on a train, tap Sign out before reconnecting: the last session
is lost.

**Fix.** After the flush, re-read the outbox; if anything remains, block sign-out with "N moves are
not saved yet — retry / sign out anyway (loses them)". Alternatively keep only the outbox key on
sign-out (it uploads on the next sign-in of the same account) and delete the readable local copy.

## 5 · Free play: a checkmating move outside the top-6 lines is scored as 0.00

**low · CONFIRMED** · `src/lib/coach/freeplay.svelte.ts:124-152,165-169`, `src/lib/chess/engine.ts:36-52`

On a mated position Stockfish 18 emits `info depth 0 score mate 0` and `bestmove (none)` — no `pv`
(verified against the shipped build; stalemate gives `score cp 0`). `parseInfo` drops lines without
`pv`, so `after.lines` is empty and `#scoreAfter` falls back to `{ cp: 0 }` whenever the learner's
move was not among the six pre-move PVs. For a mate that means `winChance` drops from ≈1 to 0 →
verdict `blunder`. If `opportunity` is set (the computer just planted a mistake), `submit` **undoes the
checkmate** (`:134`) and says "You missed an opportunity… Try again". Without an opportunity the
message is overwritten by `#checkOver` ("Checkmate — you win.") but `lastVerdict` and the red flash
stay, and `evaluation` is never updated.

Needs the mating move to be absent from the 6 PVs (seven or more mates available, or a cut-off
search), so rare, but it is the one moment the coach must not get wrong.

**Fix.** After `game.move`, if `game.isOver`, derive the score from the status (checkmate → mate for
the mover, else `cp 0`) and skip the empty analysis; then grade.

## 6 · `readJson` buffers the whole body before checking the cap

**low · CONFIRMED** · `src/lib/server/http.ts:49-55`

The Content-Length check is skipped for chunked/absent lengths; `request.text()` then reads whatever
arrives before `text.length > maxBytes` is tested. Only signed-in users reach it (`authed` checks the
session first), so the exposure is a signed-in client pushing tens of MB into Worker memory per
request. Fix: stream `request.body` with a running byte count and abort past `maxBytes`, or reject
bodies without a Content-Length.

## 7 · Navigation while the coach thinks: unhandled rejections, a hung `FreePlay`, no pull timeout

**low · CONFIRMED** · `src/routes/openings/[id]/+page.svelte:56-58,82,199`, `src/lib/chess/engine.ts:131-139,247-250`,
`src/lib/drill/synced-store.ts:168-176`

- `onMount` cleanup destroys the engine; `#rejectAll` rejects the in-flight `analyse`, which rejects
  `FreePlay.start()`/`submit()`; neither `keepPlaying`'s `await next.start()` nor Board's
  `freeplay?.submit(...)` catches it → an unhandled rejection on every navigation away mid-think.
- After `destroy()`, a later operation queued on the lock still `postMessage`s a terminated worker and
  awaits a reply that never comes: the detached `FreePlay` hangs (memory only; nothing else notices).
- `startSession` awaits `#pull`, whose two fetches have no timeout. A hung connection means "Loading…"
  for as long as the browser waits, although the local copy is right there; the `offline` fallback only
  triggers on a *failed* fetch.

Fix: `Engine` rejects operations once destroyed; catch in `keepPlaying`/`onMove`; `AbortSignal.timeout`
on the pull with fallback to the local copy.

## 8 · Adoption races the merge; two tabs can duplicate local attempts

**low · PLAUSIBLE** · `src/routes/+layout.svelte:45-53`, `src/lib/drill/synced-store.ts:168-187,216-235`

Adoption writes into the local copy directly, while `#merge` snapshots the local copy, awaits the
server, then overwrites it wholesale. Adopted rows written between the snapshot and the overwrite
vanish from the local copy for this page lifetime (they survive in the outbox and reappear after the
next load, once uploaded). Separately, `#merge` dedupes remote against local but never local against
itself, and `adoptSignedOutProgress` appends without checking, so two tabs adopting the same
signed-out history at once leave duplicate attempts in the local copy for good (server side is
deduplicated by the natural key). Confirm with a slow `/api/progress/*` and anonymous history at
sign-in. Fix: make `#pull` await adoption first (or run adoption through the same per-bundle promise),
and dedupe local attempts by `attemptKey` in `#merge`.

## 9 · `workers_dev` is not disabled

**low · PLAUSIBLE** · `wrangler.jsonc`, `src/hooks.server.ts:31`

Wrangler's schema default for `workers_dev` is `true` (`node_modules/wrangler/config-schema.json:64-68`),
and the hook only redirects `http:` and `www.`. If the `workers.dev` route is enabled on the account,
the site is also served at `lethal-chess.<account>.workers.dev` with a separate cookie jar and no
canonical redirect. Not exploitable (Google rejects the unregistered redirect URI; cookies are per
host), but a duplicate origin. Could not confirm remotely (account subdomain unknown; nothing answered
at the guessed host). Fix: `"workers_dev": false, "preview_urls": false`, and/or redirect any
non-canonical, non-local host in the hook.

---

## Verified fine

- **OAuth** — 256-bit state and verifier in 10-minute httpOnly, path-scoped, `lax` cookies; both spent
  one-shot in the callback; state compared; ID token checked for `iss`, `aud`, `exp`, `sub`,
  `email_verified === true`; client secret only in the token body with `redirect: 'manual'`; fixed
  redirect target `/` (no open redirect). Existing session invalidated on re-login (no fixation).
- **Sessions** — 32-byte token, SHA-256 id, 30-day TTL with 15-day renewal, cookie `httpOnly`/`lax`/
  `Secure` (SvelteKit default), expired rows deleted, logout POST-only under SvelteKit's origin check
  (`respond.js:83` — form content types, `trustedOrigins: []`).
- **Authorization** — user id always from `locals`; tests prove cross-user isolation for read, import,
  export and delete; `/admin` is a 404 for everyone but the allow-listed verified email.
- **Injection / XSS** — all SQL parameterised (the only template switch is a boolean); no `{@html}`;
  the one `innerHTML` (`pieces/index.ts:33`) takes vendored sprite markup for a validated set id;
  `picture` must be `https://` and CSP `img-src` pins googleusercontent; CSP is hash mode with
  `object-src none`, `frame-ancestors none`, `base-uri self`.
- **Caching** — the adapter refuses to store anything with `no-cache`/`private`/`no-store`
  (`adapter-cloudflare/files/worker.js:21`); the hook puts `no-cache` on every HTML page and
  `private, no-store` on signed-in and API responses, so no signed-out page can be replayed to a
  signed-in visitor.
- **Deletion / export** — delete clears attempts, cards, sessions, users in one batch, drops the
  cookie and the account's local keys; export is scoped by user id and omits session hashes.
- **Validation** — 2,400 ts-fsrs cards through Good/Hard/Again schedules all pass `parseCardState`;
  ISO strings are canonical; negative `responseMs` is rejected (as designed — see #2 for the consequence).
- **Bundles** — all 28 in the index; 0 empty candidate lists; every learner move is among its
  candidates; 0 dangling replies (audit #2 fix #1 holds); reply weights sum to 1; scores integral.
- **Prior fixes** — engine serial lock, `stop`, FEN-tagged results and the play controller's
  generation token (audit #1) are intact; `responseMs` per attempt and first-try coverage (audit #2)
  intact; `promotion`/castling/en passant round-trip through `parseUci`/`toUci`/`childEpd` and the
  pipeline's `normalizeCastling`.

## Resolution (2026-09-15)

All nine fixed the same day; see [[Decision Log]] "Soundness audit fixed". Tests were added for each:
- **Cycles:** `breakCycles` plus the shipped-bundle checks in `bundles.test.ts`. The rebuilt King's
  Indian and French bundles are acyclic.
- **Walk guard, future review, clamp:** `drill.test.ts` "safety".
- **Outbox:** named rejection, bisected rejection with a 1,200-row backlog, and 401 cases in
  `synced-store.test.ts`.
- **Checkmate scoring:** `coach.test.ts`.
- **Capped body reading:** `http.test.ts`.
- **Sign-out guard, engine destroy, adoption order, wrangler flags:** code review only, no test.

## Suggested order

1 (builder + client guard) → 3 (clamp in `review`) → 2 and 4 together (outbox policy + sign-out
guard) → 5 → 7 → 6, 8, 9. Log the decisions in [[Decision Log]] and update [[Opening Drills]],
[[Coached Free Play]] and [[Progress Tracking]]; the [[System Map]] still describes the pre-drill MVP
and should be brought up to date with the server layer, sync and pipeline.
