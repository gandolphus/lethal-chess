---
tags: [feature, design, flow, built, navigation, accessibility]
aliases: [Settings as a layer, Layers, Settings layer, Utility routes, Places and layers]
---

# Settings as a layer

**Status: designed and built 2026-09-18 (Fable 5.1).** Settings no longer replaces the screen you were on.
It opens *over* it — a drawer down the right on a desktop, the whole screen on a phone — and when it closes
the drill, the round, the game is exactly where you left it. The gear that opens it sits alone at the right
of the site bar. See [[Decision Log]] (2026-09-18), [[Visual Design]] for what Settings contains,
[[Exploration Mode]] and [[The Open]] for the sessions it now keeps, [[SvelteKit]] for the routing it rides.

> "If I'm in practice mode and want to change the theme real quick then I have to go to the settings page,
> but then when coming back to the previous page that page has reset. Maybe for the settings page in
> particular it should act as a window which is just overlayed on top of the page. And when exiting the
> settings whatever the user did previously is still there. … So the settings page would be a new type of
> route compared to the other pages. … On desktop I envision the settings button to gravitate to the right of
> the top bar and be a gear icon instead of the 'Settings' text."

## The problem

Every screen in the app was a **place**: a URL you navigate to, which unmounts the one before it. That is
right for the openings list, a dashboard, a session. It is wrong for Settings, because what Settings does is
*felt on the screen you came from* — you change the theme to see the board in it — and a screen that resets
the moment you go to look at it in a new theme is a screen you cannot judge a theme on. The owner's "window
overlayed on top of the page" is the correct shape; the design question was what *kind of thing* that is,
so that it is a rule and not a special case.

## The category: places and layers

A screen is one of two kinds.

- A **place** is somewhere you go. It has a URL you would bookmark, content you would read or work in, and
  you leave it for another place. Going there unmounts what came before. The openings list, a dashboard,
  a session, Today, Play, Admin — and the reading pages.
- A **layer** is something you open over where you are. Three tests, all of which must hold:
  1. **You reach it from the middle of something.** Its links are in the chrome (the bar, the small print),
     not in the flow of a task.
  2. **It has no state of its own worth coming back to.** Nothing in it is half-done; reopening it later
     is as good as returning to it.
  3. **What it does is either felt on the page behind it, or over in a moment.** A theme is the first; a
     bug report is the second.

  A layer is *still a route*: it has a URL, a reload lands on it, a link from outside works, a search
  engine or a friend can be sent to it. From inside the app it is drawn over the page instead of in place
  of it. That is the whole difference, and it is why it is "a new type of route" rather than a modal.

| Route | Kind | Why |
| --- | --- | --- |
| `/settings` | **Layer** | Reached from the bar mid-task; nothing in it to return to; its effect is the page behind it. The canonical member. |
| `/report` | **Layer — second member, not yet moved** (see open questions) | Reached mid-task, over in a moment, and its "Back to the app" link today *reloads* the page you came from, which is the very reset the owner described. |
| `/privacy` | Place | Prose you arrive at cold — from the Google consent screen, the footer, the report page. Long enough to want a scroll position and a bookmark. Changes nothing behind it. |
| `/credits` | Place | The same: a document with links out, arrived at from a link. |

Two consequences fall out of the definition:

- **A layer never navigates the page it is keeping.** Links inside it to places open in a new tab
  (`target="_blank"`, `rel="noopener"`); the two prose pages are linked from Settings and that is where the
  rule bites. A layer's own links to other layers would stack — not needed today. The one exception kept as
  a plain navigation is "Report a bug", because the report is the next layer candidate and a real link there
  is honest until it moves.
- **The bar tells them apart.** Places are words; layers are glyphs. Below.

## The mechanism: shallow routing under a native modal dialog

Two things had to be true at once — the page beneath must stay mounted, and the layer must be a route — and
[[SvelteKit]]'s **shallow routing** is exactly that pair. `pushState('/settings', { layer: 'settings' })`
adds a history entry with the layer's URL and a `page.state`, and *does not navigate*: no `load`, no
component swap, no `onNavigate` (so no cross-fade), `page.url` stays the page beneath's. The root layout
renders `<Layer>` when `page.state.layer` is set, and the layer's content is the same `Settings.svelte` the
page renders.

How each case behaves, all measured (below):

| Case | What happens | Why it works |
| --- | --- | --- |
| Click the gear mid-drill | Layer opens; address bar reads `/settings`; the drill keeps running | `pushState`, no navigation |
| Change the theme inside | The board behind repaints at once | Themes are attributes on `<html>` ([[Visual Design]]); the page beneath is live DOM, not a snapshot |
| Escape / Close / scrim / phone Back | Layer closes; the drill is as it was | Every way out is `history.back()`; SvelteKit sees the entry's navigation index is the same and only restores `page.state` |
| Forward | Layer reopens | The state is in the entry |
| Reload while open | The Settings *page* | The server renders `/settings`; SvelteKit never applies state on the first page of a document |
| Cold link to `/settings` | The Settings page, gear marked `aria-current` | It is a route |
| A link inside the layer navigates (e.g. Report a bug), then Back | The page beneath is rebuilt (it was left, so its session is gone) **with the layer open over it**; address bar `/settings` | SvelteKit stores the *beneath* URL in the shallow entry and navigates there with the state attached |
| No JavaScript | The gear is a link to the page | The link is a real `<a href="/settings">`; the interception is at document capture and only for a plain left click |
| Ctrl/⌘/middle-click the gear | A new tab with the page | `isPlainClick` refuses modifiers; SvelteKit's own handler is never involved |

**Where the click is caught.** One capture-phase click listener on the document, in the root layout: any
same-origin link whose path names a layer, clicked plainly, opens that layer. The definition is mechanical —
`LAYERS` in `src/lib/ui/layer.ts` is the list, and a link into it *is* a layer link wherever it is written.
Nothing per link; nothing per page.

**Why native `<dialog>` and `showModal()`.** It gives, for free and correctly: the rest of the document
*inert* — not focusable, not clickable — for as long as it is open; focus restored on close; `aria-modal`
semantics; the top layer, above the map sheet's `z-index: 41` without a number; and Escape as the `cancel`
event. Two things it does not give, which the code adds: keys still bubble to `window` (below), and a mouse
click on a link never focused it, so there is nothing for the dialog to restore focus *to* — the layout
remembers the anchor that opened the layer and focuses it back, with `preventScroll` (below).

**Why not the others.**

- *A store-driven modal with no URL* (`let open = $state(false)` in the layout). Loses Back on a phone —
  the one gesture every Android user will try first — and shares nothing with the cold `/settings` page,
  so there would be two Settings: one you can link to and one you can open. Shallow routing is that modal
  *plus* a history entry, at the cost of one `pushState`.
- *A layout group* `(app)/` and `(layer)/`. SvelteKit has no parallel routes: a navigation to a different
  route always swaps the page component. A group changes what wraps the page, not whether it stays.
- *`goto('/settings')` and rebuild the session on return.* The session is a live `ExploreSession` with an
  engine worker, a round's first decisions, discovery state; rebuilding it is a new session, which is the
  bug, not a fix for it.
- *Rendering Settings inline at the bottom of every screen.* Not a route; not reachable cold.
- *A `::backdrop` scrim.* Used the dialog element itself as the scrim (it fills the viewport; the panel is
  its child): a click that lands on the dialog and not the panel is a click on the scrim, and the theme's
  tokens are available without depending on `::backdrop` inheriting them.

## The bar

Before: `brand → [Openings, Today, Play, Settings] → account`, four words that read as four places.

After: **`brand → [Openings, Today, Play] ······ ⚙ → account`.**

- **Places are words** (above 560px) in a group on the left; **the layer is a glyph** on the right, at
  every width, with its word kept in a visually-hidden span (`clip-path`, not `display: none`, the same
  rule the phone glyphs follow — [[Decision Log]] 2026-09-17) and a `title` for the tooltip. Position
  says "different kind"; the glyph says "a control, not a destination".
- The gear carries `aria-haspopup="dialog"` and `aria-expanded` while its layer is open; on its own page
  it carries `aria-current="page"` like any destination. Lit the same way in both states.
- **Below 560px** the destinations are already glyphs, so the difference is position and a hair of space
  (`0.3rem`) before the gear — all a 320px bar can afford. Measured at 320: `scrollWidth 320`, the Sign-in
  button's right edge at 309, bar 52px tall, one row.
- **A gear, drawn like the other glyphs**: two circles and eight spokes, stroke only, `currentColor`, so no
  theme needs to know it exists. The old `sliders` glyph is gone.
- The desktop close button sits in the same row as the bar at the panel's top right, so the way out is
  where the way in was (gear centre x 1266, Close centre x 1323 at 1400 wide).

## The overlay

**Desktop (above 860px): a drawer.** `min(36rem, 100%)` wide, full height, down the right, with a left
hairline and a shadow; slides in from the right over `--move-ms` on the theme's `--ease`, slides out the
same way before the history entry is popped. The scrim is a 40% wash of `--bg` — light on purpose: the
whole point is to watch the board change, and a session's board is on the *left*, so the drawer covers the
panel and leaves the board in view (screenshot: `layer-desktop-themed.png`). 36rem gives the theme grid
three swatches to a row.

**Phone (860px and below): the whole screen**, like the line map since 96f4737 — a sheet with the page
showing round it reads as a window, and a phone has no room for windows. Rises from the foot; keeps clear
of the notch with its own safe-area padding, since fixed positioning escapes the body's; the Close button
is thumb-sized (40px tall, measured) with a cross and no `Esc` hint (`kbd` display none, measured).

**Scrolling.** The layer's body is the scroll container (`overflow-y: auto; overscroll-behavior: contain`)
and the root is locked (`:root:has(dialog[data-layer][open]) { overflow: hidden }`) while it is open. The
app's `scrollbar-gutter: stable` means the lock moves nothing. The shell rule `body:has(main[data-shell])
{ height: 100dvh }` is untouched — the dialog is in the top layer and takes no part in the body's layout.
Measured on the openings list scrolled to 400: 400 while open, 400 after a wheel over the scrim, 400 after
wheeling past the panel's end, 400 after close.

**Closing**: the Close button, Escape, a click on the scrim (desktop), the Back button or gesture, and
Forward reopens. All end in `history.back()`; nothing calls `dialog.close()`. Reduced motion: no animation,
so nothing to wait for (`getAnimations()` is empty and `close()` resolves at once).

## Accessibility

- **Focus trap and inertness**: `showModal()`. Measured: with the layer open, `document.querySelector('.tool').focus()`
  leaves focus on the Close button inside the dialog.
- **Initial focus**: the Close button, as the map sheet does — the way out is the first thing a keyboard
  finds, and it is where the gear was.
- **Focus restoration**: to the anchor that opened it, `preventScroll: true`. Measured: after Escape,
  `document.activeElement` is the gear; opened by keyboard, the ring shows on Close and then on the gear
  (`:focus-visible` true both times); opened by mouse, on neither.
- **`aria-modal="true"`, `aria-labelledby`** the layer's title.
- **Escape**: the dialog's `cancel`, prevented and routed through the same close as the button, so the
  history entry always follows. If the browser ever closes the dialog itself (a second Escape without user
  activation is the documented case), the `close` event pops the entry too.
- **Keys stop at the dialog.** The session screen, Today, the dashboard and the map all listen on
  `window` — `n` restarts the drill, `e`/`p`/`o` switch modes, `Escape` closes the map. Focus is inside
  the dialog, so every keydown bubbles through it, and one `stopPropagation` there keeps them out.
  Escape's `cancel` is a default action, not a listener, and still fires. Measured: `n` pressed with the
  layer open leaves the position unchanged.
- **No JavaScript / assistive tech that does not run it**: a plain link to a plain page.

## What had to be found by measuring

1. **The drill restarted when the layer closed.** Opening was fine (`pushState` touches only `page.state`);
   closing was not. SvelteKit's popstate handler assigns `page.url = new URL(entry.url)` — a *new object with
   the same value* — on every step through history, shallow or not. The session screen's start effect read
   `page.url.searchParams` directly, so the new object re-ran it and began a new session over the one being
   played. It now depends on two `$derived` strings (`line`, `ply`), which do not change, so the effect does
   not run. **Rule: an effect that must run once per screen depends on the values a URL carries, never on
   `page.url` itself.** Only this one effect in the app was exposed (grepped).
2. **Closing on a scrolled list jumped to the top.** SvelteKit restored the scroll (400) correctly; what
   moved was `opener.focus()` pulling the gear, in the bar, into view. `focus({ preventScroll: true })`.
3. **A "double Settings" guard that could never fire.** Assumed that Back from a link out of the layer
   would land on the `/settings` route with the state still attached and draw the content twice. SvelteKit
   stores the *underlying* page's URL in a shallow entry, so Back navigates to the drill and reopens the
   layer over it (`h1: Italian Game, dialogs: 1`). The guard was dead code and was removed; `layer` is
   simply `page.state.layer`.
4. **On a phone, a tap during a fling is not a click.** A harness artefact (the swipe left the panel
   scrolling and the Close tap only stopped it) but a real phone behaviour: a scrolling sheet's Close needs
   a second tap, which is what every native app does too.
5. **A mouse event under touch emulation never returns** in the CDP harness; phone runs must use touch
   points for everything, including moves.

## Measured

Desktop 1400×1000 and phone 390×844 (touch, coarse pointer), Italian Game, Explore, after 1.e4 e5 2.Nf3
Nc6, with a probe property stuck on `main[data-shell]` so a remount would lose it:

| | Before | Open | After close |
| --- | --- | --- | --- |
| URL | `/openings/italian-game/explore` | `/settings` | `/openings/italian-game/explore` |
| `main[data-shell].__probe` | `kept` | `kept` | `kept` |
| Occupied squares | 32, e4 f3 c6 e5 among them | same | same |
| `<title>` | Italian Game · Explore | same | same |
| `d4` background (theme) | `rgb(76,76,84)` Obsidian | `rgb(59,80,104)` after picking Tide | `rgb(59,80,104)` |
| `document.activeElement` | body | the Close button | the gear |
| root `overflow` | visible | hidden | visible |
| page overflow (phone) | 0 | 0 | 0 |

Same result for Escape, Forward then Escape, scrim click, keyboard open and close, the phone's Close tap, and
the phone's Back. `pnpm check` 0 errors 0 warnings; 550 tests green (12 new: the layer's link rules and the
bar's structure); production build clean.

## Rejected

- Making Privacy and Credits layers "for consistency". They fail the first test (arrived at from a link
  elsewhere, including from outside the site) and the third (they change nothing behind them). Reading a
  policy in a drawer over a chess board is also simply worse.
- A centred modal on desktop. It covers the board, which is the one thing a theme change needs in view.
- Keeping the word "Settings" in the bar on desktop next to the gear. The owner asked for the glyph, and the
  word is what made it read as a fourth destination.
- A separate `Sheet` for phones. One `<dialog>` with a media query is the same element at both sizes, which
  is what makes the keyboard, focus and history behaviour identical on both.
- Changing the tab's `<title>` while the layer is open. The page beneath owns the tab; two `<title>`s in
  `svelte:head` would fight.

## Open questions for the owner

1. **Move `/report` into the category.** It passes all three tests and its "Back to the app" reload is the
   owner's complaint in another place: a tester who hits a bug mid-round should report it and carry on. What
   it takes: `Report.svelte` lifted out of the page as `Settings.svelte` was; `from` becomes
   `page.url.pathname` (already true for a layer); `use:enhance` with `update({ invalidateAll: false })` so
   a sent report does not re-run the session's `load`; and `page.form` cleared on close so the next open is
   an empty form. Half a day. Recommended.
2. **Links from a layer to a place open a new tab.** The alternative — navigate, and lose the session — is
   what the feature exists to prevent, but a new tab in the installed app opens the system browser. Easy to
   reverse (`layered` prop on `Settings.svelte`).
3. **A keyboard shortcut for Settings** (`,`, as on a Mac). Not added: the session's single-letter keys are
   for play, and a shortcut to a layer that stops the keys is a shortcut people would hit by accident.
4. **The phone's swipe-down to close.** Not added; Back and Close both work, and a vertical swipe on the
   sheet is a scroll.
