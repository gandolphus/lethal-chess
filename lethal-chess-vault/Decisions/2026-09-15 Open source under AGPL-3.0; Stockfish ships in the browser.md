---
status: accepted
date: 2026-09-15
tags: []
---
# Open source under AGPL-3.0; Stockfish ships in the browser

**Reverses** "no browser engine" from the Public MVP entry below, the same evening. The user wants
coached play past the end of a line ([[Coached Free Play]]): grading any move, natural computer replies,
planted mistakes. That needs an engine that can evaluate *arbitrary* positions live; Lichess cloud eval
covers only already-analysed positions and fails a few moves after a deviation.

Options were browser engine + publish source (AGPL) or server engine + closed source. User:
"engine in the browser for now with the open source license for sure." Chosen for instant response,
zero server cost, offline capability, and speed to ship. `LICENSE` is the official AGPL-3.0 text;
`package.json` declares `AGPL-3.0-or-later`. Consequences: cburnett (GPLv2+) is usable publicly;
[[Engine licensing]] is resolved; a closed paid tier is off the table unless this is revisited.

**Still to do before public launch:** a public source repository and a visible "Source" link (AGPL §13).
