---
status: accepted
date: 2026-09-16
tags: []
---
# A black piece carries one light line, in every theme

The owner: "some of the black pieces get different coloured outlines only in some themes … they look
really ugly." Cause: a black piece is drawn from `--pbs` (edge) and `--pbh` (detail), and Night set them to
two different lights (`#93a7c8` / `#cfdcf2`), so only the pieces with interior detail — knight, king,
bishop, cburnett's engraved set — showed a second colour. The Nocturne set's rim filter also flooded a
hard-coded `#d6e8ff`, a third light. Rule now: **where the edge is light, the detail is the same colour**
(Night's `--pbh` dropped to the edge value; brightening the edge instead turned every black piece into a
hollow line drawing that competed with white). The rim floods `var(--pbh)`, the theme's one highlight, so
it equals the edge in Night and Graphite and the detail everywhere else. `tokens.test.ts` parses `app.css`
and fails any light-edge theme whose `--pbh` differs from `--pbs`. Details in [[Visual Design]].
