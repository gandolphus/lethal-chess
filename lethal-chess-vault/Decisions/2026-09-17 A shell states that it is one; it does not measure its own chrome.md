---
status: accepted
date: 2026-09-17
tags: []
---
# A shell states that it is one; it does not measure its own chrome

The first version of the app shell below capped each screen with `max-height: calc(100dvh - 3.25rem)`.
That number is the nav's height, and a screen that has to know how tall the thing above it is will be
wrong the moment anything else goes there — an update banner, a wrapped nav, a larger root font. It
shipped, and the owner still had a scrolling screen: *"there is still empty space underneath which can
be scrolled to."*

The replacement is a fact the screen states about itself rather than a measurement it takes:

```css
/* src/app.css */
body:has(main[data-shell]) { height: 100dvh }
```

`height`, not `min-height`, so the shell cannot be pushed taller; `main` is already `flex: 1;
min-height: 0`, so it receives exactly what the nav, any banner, the footer and the safe-area padding
leave. Four screens opt in with `<main data-shell>` — the session screens, Today, Play and the opening
dashboard. The openings list and Settings say nothing and scroll, which is what they are for.

**What the audit actually caught.** A sweep of 8 phone widths × 9 heights × 4 root font sizes against
the live site found the real defect at **320px wide**: the Sign-in button sat 15px past the right edge,
Chrome widened the layout viewport to 335px to fit it, and the page then scrolled *vertically* by 27–44px
as a consequence. The same failure as the spine, in a different row — **horizontal overflow on a phone
presents as vertical scrolling**, because the browser's answer to a too-wide row is to zoom the page out.
The wordmark now shrinks, and drops "chess" under 380px.

Ruled out by measuring, each of which had looked like the answer: safe-area insets on a notched phone
(`flex: 1` already absorbs them), a `dvh`/`svh`/`lvh` mismatch (everything uses `dvh`; no `100vh` is used
for layout), the update banner, and a stale service worker (navigations always go to the network and CSS
is build-hashed). Clean at all 288 combinations after, except 320px wide at a 24px root font.
