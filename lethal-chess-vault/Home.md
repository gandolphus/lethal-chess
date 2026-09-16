---
tags: [moc, home]
aliases: [Home, lethal-chess]
---

# Home · lethal-chess

Entry note for the planning / brainstorm / decision / memory vault. Lives at `lethal-chess-vault/` inside the project repo (Catppuccin Mocha theme).

## Vision

**A tool for drilling chess, starting with openings.** Not a course, not an analysis board — a
training loop. You meet a position, you play the move, you find out immediately whether you were
right, and the system decides when you see it again. The goal is *instinctive recall* of a
repertoire, not knowledge that you can only reconstruct slowly.

This is a **deliberate narrowing** of the earlier "Chess Lethality Visualizer" concept (see
[[Lineage — from lethality analyzer to drilling tool]]). That project's premise — that the
interesting signal is *how humans actually fail*, not what the engine prefers — is still the
long-term differentiator, and its scoring pipeline still exists in `../chess-lethality-analyzer`.
But it is parked. First build the thing that is useful to one person every day.

## Current state

MVP is playable: [[Play vs Computer]] — board, legal moves, engine opponent. That is the
substrate the drilling layer sits on, not the product.

## Maps of content

- [[System Map]] — architecture, directory layout, data model (source of truth for *what exists and why*).
- [[Decision Log]] — dated, rationale-bearing record of every locked decision.
- [[Stack (MOC)]] — the technologies in use.
- [[Data sources]] — what data exists for classification, all verified.

## Features

**Direction (2026-09-15): precision first. A serious tool, not a hacky one.** Objective engine truth
only; rating-based strategy is at the bottom of the backlog.

- [[Public MVP]] — **in progress, top priority**. Novice-friendly Learn → Practice → Progress on
  lethalchess.com; Google sign-in; Cloudflare Workers + D1; no browser engine.
- [[Coached Free Play]] — **built**. After a Learn line ends, keep playing: verdicts on every move,
  natural computer replies, planted mistakes to punish.
- [[Exploration Mode]] — **built, replaces Learn**. Given opening moves, then secret lines: entered → discovered, dubious lines apart, try again / play on.
- [[Opening dashboard]] — **designed, shell built**. `/openings/[id]` is where you choose how to approach an
  opening (Explore · Practice · The Open) and see where you stand: the map, found, readiness.
- [[The Open]] — **designed, not built**. Five rated rounds against scouted opponents; readiness rating per
  opening. Subsumes the "human moves" ask; the opponent's design is in [[Opening dashboard]].
- [[Your games]] — **agreed direction, not built**. Read the learner's real games (chess.com needs only a
  username), show their real repertoire and where they leave book, then drill it.
- [[Monetization]] — **open**. Free scan, paid loop; coaches as the sharpest wedge.
- [[Off-book Practice]] — **designed, first after launch**. Drill punishing the unusual moves opponents
  actually play, not only the book. The blind spot most drilling tools share.
- [[Play vs Computer]] — **done (MVP), audited + fixed**. Board + Stockfish opponent. Local builds only.
- [[Opening Drills]] — **designed, first priority**. English (White), Sicilian and Caro-Kann (Black);
  catalog-named tracks, eval-graded moves, sharpest lines first.
- [[Progress Tracking]] — **designed**. Append-only attempt log in SQLite; proficiency per track,
  family, repertoire.
- [[Visual Design]] — **ported + overhauled**. 8 theme families (dark / light) and 8 piece sets selectable in settings, eval bar,
  redesigned picker and drill page.
- [[Opening Classification]] — **designed, catalog imported, second priority**. Objective cost,
  precision burden, weaknesses; drill the punishment.
- [[Installable app]] — **built**. Home-screen install (manifest, icons, service worker) that never
  serves a stale page.

## Research

- [[Learning science for opening training]] — evidence digest, critique and 15 ranked proposals (2026-09-16).

## Audits

- [[2026-09-15 — Fable code audit]] — 7 findings, all fixed and verified.
- [[2026-09-15 — Fable design review]] — strength/weakness definitions, pipeline, drill model.
- [[2026-09-15 — Fable correctness audit 2]] — 9 findings; the drill dead-end bug and four more fixed.
- [[2026-09-15 — Fable soundness audit]] — 9 findings (cycles, sync queue, sign-out, scheduler…); all fixed.

## Daily logs

- [[2026-09-15]] — kickoff, stack chosen, MVP playable, audits, catalog imported.

## Backlog

- Foundation: audit refactors, SQLite persistence, theme tokens (after [[Visual Design]] review).
- Eval-db cache + tree builder for the three repertoires.
- *Bottom of the list, "maybe":* rating-band stats, practical edge, "beat players at your level".
- [[Engine licensing]] — Stockfish is GPL-3.0. Decide before anything commercial.
- Piece rendering: Unicode glyphs are a placeholder, want SVG.
- Board keyboard/screen-reader support.
