---
tags: [feature, idea, monetization]
aliases: [Your games, Game import, Deviation finder]
---

# Your games

**Status: agreed direction 2026-09-16, not built.** The owner's idea: read the learner's real games and
build practice around them. It is also the core of [[Monetization]].

## Why this one

It is the only feature that makes the trainer about *their* chess, it produces new material every week
without authoring, and no competitor turns a deviation into a drill inside a discovery map. It is
[[Learning science for opening training]]'s P14, promoted.

## Feasibility, checked 2026-09-16

- **chess.com needs no account.** The Published-Data API takes a username, needs no auth, and answers
  `access-control-allow-origin: *` (verified live against `api.chess.com/pub/player/…`). So the import can
  run **entirely in the browser**: no server cost, nothing stored, nothing to disclose for a signed-out
  visitor.
- **Rate limits:** serial requests are unlimited; parallel ones get 429. One request at a time.
  A recognisable user-agent with contact details is recommended, which a browser can't set — an argument
  for a Worker proxy later, against the privacy win of going direct.
- **Commercial use is not addressed** in their terms (they cover rate limits and their IP). Before
  charging for anything that depends on it, email legal@chess.com.
- **Lichess** is the clean alternative: OAuth, CC0 game data, explicit API terms. Support both; lead with
  Lichess if chess.com ever objects.
- **Depth costs.** The eval cache covers positions with ≥ 26 pieces, i.e. the opening. Everything past the
  book needs Stockfish, which Workers cannot run: do it in the browser with a progress bar, or pay for a
  real machine.

## v1 — the free scan (no signup, browser only)

Type a username →
- what they actually play, by frequency, per colour;
- the ply where they leave established theory, per opening, and the average;
- who deviated first, them or the opponent;
- the handful of positions where it keeps going wrong.

Each row offers **Explore this** and **Drill this**. It doubles as the best advertisement the site could
have, and it is the onboarding answer to "which of the 28 openings is mine?".

## v2 — the loop (paid)

- Keeps syncing as they play; tracks whether a leak closed.
- Their own mistakes become review lines; opponents' deviations become punish drills
  ([[Off-book Practice]]).
- **Review in the style of chess.com's Game Review, but aimed at comfort in the positions they keep
  meeting** (owner, 2026-09-16): not a score per move, but "here is the position you land in twice a week;
  here is what to understand about it", then practice branching around it.
- **Frequency weighting in [[Exploration Mode]]'s daily session:** lines building on positions the learner
  actually meets get extra attention, ahead of lines they will never see.
- History, cross-device, and analysis past the book.

## Open questions

- A username is not proof of identity: public data, but results are stored only under the account that
  asked for them, and the privacy page must say so.
- How far past the book to analyse before it stops being an opening trainer.
- Whether frequency weighting should override spaced repetition's due dates, or only break ties.
