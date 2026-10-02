---
status: accepted
date: 2026-09-16
tags: []
---
# Typeface is chosen apart from the theme; settings never move

The owner asked for the font settings to be separate, after noticing that switching themes nudged the
settings page around. Both are now fixed:
- **`data-font` on `<html>`**, seven choices including "Match the theme" and "System"; stored with the
  theme and piece set, previewable with `?font=`. The blocks live after the theme blocks in `app.css`.
  The section sits below Pieces: pieces matter more (owner).
- **No layout shift:** the nav has a fixed height, the footer a minimum one, the theme swatch's board is
  `border-box`, and the settings page pins its own type and re-reads it with an explicit `font-family`
  (setting the token alone does nothing, because inheritance passes the resolved family). Each pairing is
  shown in its own sample instead. Verified by measuring every element across three themes: identical to a
  tenth of a pixel.
