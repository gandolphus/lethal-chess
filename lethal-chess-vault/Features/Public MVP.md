---
tags: [feature, planned, launch]
aliases: [Public MVP, Launch]
---

# Public MVP — lethalchess.com

**Status: decided, in progress (2026-09-15).** Architecture and rationale: [[Decision Log]]
2026-09-15 "Public MVP on lethalchess.com".

> "An MVP where a novice can start practicing pretty well, with a database and Google auth so data is
> saved. Put it on lethalchess.com. It would be fun to send a link to a friend and have them practice
> the Ruy Lopez."

## The novice flow

1. **Pick an opening** from the launch set.
2. **Learn** *(replaced by [[Exploration Mode]] 2026-09-15)* — walk the line; the board shows each move with an arrow and you replay it. The variation
   name appears as you enter it (catalog-sourced, never LLM-written).
3. **Practice** — [[Opening Drills]]: spaced repetition, weighted opponent replies, eval grading
   (pass / "sound, but not your line" / fail with refutation).
4. **Progress** — [[Progress Tracking]], per account, per opening.

## Launch set

Ruy Lopez · Italian Game · English · Sicilian · Caro-Kann.

## Progress (2026-09-15, evening)

- ✅ **Tree builder** — 5 bundles, 120 learner decisions each, ~130 KB, 0–5 missing evals. Trees are real
  theory (Closed Ruy Lopez main line; Najdorf main line; anti-Sicilians included).
- ✅ **Drill core** — `grade`, `tree`, `scheduler` (ts-fsrs, MIT), `session`, `progress`; 74 tests.
- ✅ **UI** — `/` opening picker, `/openings/[id]` Learn/Practice, `/settings` (theme + piece set,
  per browser), `/play` (local only). Board server-renders the root position while loading.
- ✅ **Board: right-click never opens the browser menu; it cancels a picked-up/selected piece**
  (user requirement — also handles right-press *during* a drag, which arrives as a chorded pointermove).
- 🔨 Google auth + D1 + API (subagent, strict file ownership), Fable correctness audit #2 (read-only).
- ⏳ Theme port (round 1 + 2 into settings; cburnett excluded from public — GPL), deploy.

**Verification tool:** headless Firefox screenshots fire before JavaScript runs. Chromium from nixpkgs with
`--virtual-time-budget=8000` waits for hydration and logs the console — used to confirm the drill page
works end to end (Berlin → 4.O-O arrow, no console errors).

## Build order

1. **Tree builder** → per-opening bundles from the eval cache ([[Data sources]]).
2. **Drill controller + Learn/Practice UI**, grading client-side from bundles.
3. **Cloudflare**: SvelteKit Cloudflare adapter, D1 schema (users, sessions, attempts), Google OAuth.
4. **Visual design**: integrate the chosen round-2 direction ([[Visual Design]]).
5. **Deploy** to lethalchess.com, replacing the Coming Soon page.

## Needed from the user

- **Google OAuth client** (Google Cloud Console → OAuth consent screen, External, scopes
  `openid email profile` → Credentials → OAuth client ID, Web application) with redirect URIs for
  `https://lethalchess.com` and local dev. Client ID + secret go into Cloudflare secrets, never git.
- **Cloudflare access** from this machine (`wrangler login`), and where the Coming Soon page is
  currently hosted.

## Not in the MVP

Play-vs-computer (GPL engine — [[Engine licensing]]), rating-based anything, LLM explanations,
[[Opening Classification]].
