---
status: accepted
date: 2026-09-16
tags: []
---
# Chessnut's black pieces are engraved, not outlined

Supersedes the morning's `BLACK_EDGE` change, which addressed `#000` strokes Chessnut's black pieces do not
have. They are filled silhouettes with light drawing traced just inside the edge; on near-black squares
that drawing at full `--pbh` became a white outline ringed by the dim body. The set's black line-work is
now held at 70 % of the highlight toward the body, one colour for strokes and fills, so the piece reads as
one dark shape with engraving in every theme. Cburnett unchanged. Details in [[Visual Design]].
