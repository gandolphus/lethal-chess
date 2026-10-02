---
status: accepted
date: 2026-09-18
tags: []
---
# The bug report is the second layer, and a layer never loses what was typed in it

The owner, on the three open questions: move `/report` now; links out of a layer keep opening a new tab
(*"new links always open new page"*); leave the drawer's dimensions alone. `/report` is a form, which
Settings is not, so three more decisions ([[Settings as a layer]], *The report as a layer*):

- **Closing keeps the words.** A half-written report goes to `sessionStorage` on every keystroke and comes
  back when the form opens — through Escape, the phone's Back, another layer over it, a page change in the
  same tab. Cleared on send; empty drafts are removed. Not a confirm on close (the phone's Back cannot be
  intercepted, and a `confirm()` over a modal is a dialog on a dialog); not discarding.
- **The server's answer stays in the layer.** `use:enhance`'s default applies it to the page: a success
  re-runs the page's `load`, and a thrown action *replaces the page with the 500 page* — measured, the drill
  went with it. Success, failure and error are now the component's own state; only a redirect reaches
  SvelteKit, without invalidating. Reopened after a send, the form is empty, not a second thank-you.
- **The subject is the page beneath.** Layered, `from` is `page.url.pathname` (which `pushState` leaves
  alone); cold, the page's `?from=`. Both through `ownPath()`, now in `$lib/report.ts` and tested.

Sent end to end against the local emulated D1 (migrations applied to `.wrangler/state`, never production):
the row holds the words as typed, the drill's path and the viewport. On a phone the report is reached
through Settings, in the same dialog with its content swapped, and Back walks the stack to the drill.
