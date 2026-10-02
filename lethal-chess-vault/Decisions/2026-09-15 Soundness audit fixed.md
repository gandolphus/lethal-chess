---
status: accepted
date: 2026-09-15
tags: []
---
# Soundness audit fixed

[[2026-09-15 Fable soundness audit|2026-09-15 — Fable soundness audit]] found 9 issues (1 high, 3 medium, 5 low); all are fixed.
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
