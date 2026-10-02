---
status: accepted
date: 2026-09-17
tags: []
---
# The site bar is glyphs on a phone, and the words stay for screen readers

*"Perhaps we can compress it to just one if we instead of displaying the titles for the routes we show
suitable icons."* Below 560px the bar was two rows (82px); it is now one (52px), with an inline SVG per
destination and the label kept in a `<span class="word">` hidden by `clip-path`, **not** `display: none`
— which would leave each link with no accessible name. `nav.test.ts` asserts both halves: every glyph is
followed by its word, and the phone rule never turns to `display: none` or `visibility: hidden`.
