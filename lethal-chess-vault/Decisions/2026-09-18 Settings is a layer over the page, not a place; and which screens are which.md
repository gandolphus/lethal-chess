---
status: accepted
date: 2026-09-18
tags: []
---
# Settings is a layer over the page, not a place; and which screens are which

*"If I'm in practice mode and want to change the theme real quick then I have to go to the settings page,
but then when coming back to the previous page that page has reset. Maybe for the settings page in
particular it should act as a window which is just overlayed on top of the page … a new type of route."*

**Screens are of two kinds.** A **place** is somewhere you go (the list, a dashboard, a session, Privacy,
Credits): its URL replaces the one before it. A **layer** is something you open over where you are; it must
pass three tests — reached from the middle of something, nothing in it worth coming back to, and its effect
is either felt on the page behind it or over in a moment. **`/settings` is a layer.** `/report` passes the
tests and is the second member, not yet moved. Privacy and Credits are places: arrived at cold, from
outside, and they change nothing behind them. Full design in [[Settings as a layer]].

**The mechanism is SvelteKit shallow routing under a native `<dialog>`.** A plain click on any same-origin
link to a layer's path — caught once, at document capture, in the root layout — is a `pushState` to that
URL with `{ layer }` in `page.state`, which adds a history entry and navigates nothing: no `load`, no page
swap, no cross-fade, `page.url` still the page beneath's. The layout draws the layer when the state names
it. Every way out is `history.back()`. So Back and the phone's gesture close it, Forward reopens it, a
reload or a cold link lands on the ordinary Settings page, and a modifier-click is a new tab. `showModal()`
makes the page beneath inert and restores focus. Rejected: a store-driven modal (no Back, two Settings), a
layout group (SvelteKit has no parallel routes; a different route always swaps the page), rebuilding the
session on return (that *is* the bug).

**The bar reads the difference.** `brand → [Openings, Today, Play] ······ ⚙ → account`. Places are words on
a desktop; the layer is a glyph at every width, on the right with the account, its word kept for screen
readers. Desktop: a 36rem drawer down the right, so the board on the left stays in view while the theme
changes behind a 40% wash. Phone: the whole screen, as the map is.

**Found by measuring, not by reading.** Closing the layer restarted the drill: SvelteKit assigns a *new
URL object* to `page.url` on every history step, including a shallow one, and the session screen's start
effect read `page.url.searchParams` — so it re-ran. It depends on the two derived values now. **An effect
that must run once per screen depends on the values a URL carries, never on `page.url` itself.** Also:
focusing the gear on close scrolled a long list to the top (`preventScroll`); and a "drawn twice" guard for
a case SvelteKit cannot produce (a shallow entry remembers the *beneath* URL, so Back from a link out of
the layer returns to the drill with the layer open) was removed as dead code.

Proven with a probe on `main[data-shell]`, the occupied squares, the URL and the title, before, during and
after each way of closing, on desktop and phone.
