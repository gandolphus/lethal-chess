---
status: accepted
date: 2026-09-17
tags: []
---
# An opening's name and its first moves appear once per screen

*"Underneath the board there are two cards, both of which inform the user of the opening and its opening
moves, obviously redundant… having the name of the opening and it's first moves might be good to keep
nonetheless but only in one place."* Explore had them **three** times: the panel header, the idle line
card ("The opening / Italian Game / 1.e4 e5 2.Nf3 Nc6 3.Bc4"), and the notice ("Play the Italian Game /
It starts 1.e4 e5…").

**The header keeps them.** It is the screen's identity, it carries "You play White" and the way back, and
it is now rendered on phones too (compact, and last in the column — by then the reader has chosen the
opening twice). The idle line card is gone and the notice says what to do, not what this is: *"Play the
opening / Play through its first moves. What comes after them is yours to discover."*

Consequence: inside the opening the line slot has no card at all, and its reserved `min-height: 6.4rem`
read as a hole. `.line-slot:not(:has(.discovery))` collapses it. The slot still holds its place once a
game is under way, which is what the reservation was for.
