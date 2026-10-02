---
status: accepted
date: 2026-09-16
tags: []
---
# An opening opens on a dashboard; the sessions get their own URLs

The owner: clicking an opening should open "the openings dashboard. From here you can select how you want
to approach the opening in question, and also see various interesting information." `/openings/[id]` is
now that screen ([[Opening dashboard]]): the line map on the left where a board would be, and on the right
two headline figures (**Readiness**, from [[The Open]], shown as its empty state until that exists; **Found**),
two states (Remembered, Due), and three approach cards — Explore, Practice, The Open — with the one the
numbers point at marked. The playing screen moved to `/openings/[id]/explore` and `/practice`, one route
with a param matcher so a mode switch keeps the engine and the bundle, and it replaces the history entry
so Back returns to the dashboard. The bundle loads once in a layout for all of them. A returning learner
always lands on the dashboard: the choice is the point. Rejected: keeping the board as the landing and
adding a mode; a fourth card for "human moves", which [[The Open]] subsumes; lethality dots, the
by-variation list and the retired proficiency numbers on the dashboard, as noise about the wrong thing.
