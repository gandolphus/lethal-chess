---
status: accepted
date: 2026-09-15
tags: []
---
# Persistence is SQLite on disk via the SvelteKit server

Reverses "no backend" for one reason: the user requires **reliable** progress tracking. Browser
storage is per-browser, evictable, and invisible to backups; a SQLite file is none of those.
Using Node 24's built-in **`node:sqlite`** (verified working, no flag, no native build — so no
repeat of the [[pnpm]] install-script trouble).

The attempt log is **append-only** (card, time, move played, expected, grade, cp loss, response time);
scheduling state (FSRS) and proficiency are *derived* from it. So the scheduling algorithm or the
proficiency formula can change later and be recomputed over full history — nothing is lost to an
early design mistake.
