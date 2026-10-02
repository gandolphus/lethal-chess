---
status: accepted
date: 2026-09-16
tags: []
---
# Line card anticipates, then celebrates; no evaluation while learning

- **The card follows the line.** Per the user, it anticipates a line from its entrance, with progress
  pips, and celebrates when the final move is reached, whichever side plays it. One-move lines celebrate
  immediately. See [[Exploration Mode]].
- **No evaluation on the opening page.** The eval bar and number are removed at the user's request:
  relative strength distracts while learning, and it belongs in a future analysis mode. The play page
  keeps its bar.
- **Deployed.** Exploration, the audit fixes and this card went live together. Remote D1 migration
  0002 was applied by the user, and I verified it (`discoveries` table present, no pending migrations).
