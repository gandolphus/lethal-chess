---
status: accepted
date: 2026-09-16
tags: []
---
# The Open ships as one round against a human-shaped opponent, and nothing around it

The owner, having read the full design in [[The Open]]: "I'm not super convinced we've found it just yet.
But what we could do is start out with something simple. Basically the idea of 'The Open' is to simply get
a chance to use the opening in situations which don't feel like playing against an engine. You don't know
which moves will show up. But the goal is to play *precisely* against whatever move shows up… When we have
that in place and I can play around with it I think I might get a better idea for what to do with this."
So only the atom is built: `/openings/[id]/open`, eight learner moves from the defining position against
an opponent who draws each move from three flavours — theory, the dangerous middle, junk — in a mix that
drifts from theory as the round goes on. The standard is precision (within 0.05 win chance of the best),
a miss never stops the game, nothing is spoiled until the round ends, and then everything is. Composure,
rounds, a run, the draft, scouting, personas, the rating and rust stay designed and unbuilt until the atom
has been played. No control on the opponent and no competency gate ("let's allow it for now since I need
to test the feature anyway"). Built as two options on `ExploreSession` — `opponent: 'human'` and
`roundMoves` — not a second session class, so grading, hints, take-back, browsing and discovery are shared.
