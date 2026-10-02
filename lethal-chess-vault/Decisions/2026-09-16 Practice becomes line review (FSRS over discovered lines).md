---
status: accepted
date: 2026-09-16
tags: []
---
# Practice becomes line review (FSRS over discovered lines)

The overnight research ([[Learning science for opening training]]) ranked line mastery first: a
discovered line was never asked again. Practice now replays discovered lines from memory. It starts at a
random point, with the name hidden; a sound move from another line counts as Hard, a miss or the arrow as
Again. FSRS state is derived from an append-only `line_reviews` log (migration 0003). Admin "active
learners" now counts discoveries and line reviews too, since exploring records no attempts. The old
single-move tree Practice is retired from the UI. Details in [[Exploration Mode]].
