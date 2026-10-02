---
status: accepted
date: 2026-09-17
tags: []
---
# Mode switching belongs to the dashboard, not the session screen

*"Also the toggling between modes isn't important to have on this page. Instead the user can return to the
opening's dashboard and click from there instead."* The Explore / Practice / The Open tablist is gone from
`/openings/[id]/[mode]`; the [[Opening dashboard]] already presents the three as cards with their state
("103 lines to find", "Nothing to replay yet"), which is a better place to choose from than three tabs
that cannot say why. The `E` / `P` / `O` keyboard shortcuts stay — they cost no pixels.

This freed the phone's only wrapping row. In its place: **← Dashboard** and **Moves & progress**, which
also fixes an old workaround — the back link used to live in the bottom sheet *because* "the mode row has
no room for another button".
