# Piece set licences

| Set | Origin | Licence | Files |
|---|---|---|---|
| monolith, material, instrument, nocturne | Drawn for Lethal Chess (design rounds 1–2, `custom.ts`) | Project licence | — |
| chessnut | Lichess `public/piece/chessnut` (per `lila/COPYING.md`) | Apache License 2.0 | `chessnut/LICENSE.Apache-2.0.txt`, `chessnut/NOTICE` |
| cburnett | Colin M. L. Burnett's chess pieces (Wikimedia Commons; shipped by Lichess as `public/piece/cburnett`, listed GPLv2+ in `lila/COPYING.md`) | GPL-2.0-or-later (the Commons upload is additionally offered under BSD and GFDL) | `cburnett/LICENSE.GPL-2.0.txt`, `cburnett/NOTICE` |

The SVG sources are kept verbatim; `imported.ts` only rewrites their `#fff`/`#000`
palette to theme tokens at load time.
