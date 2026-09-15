---
tags: [tech]
aliases: [SvelteKit, Svelte]
---

# SvelteKit

SvelteKit 2.70 / Svelte 5.57 / Vite 8. Chosen over React — rationale in [[Decision Log]] 2026-09-15.

## Gotchas found on setup

- **No `svelte.config.js`.** Current `sv create` puts the adapter and compiler options inside
  `vite.config.ts` under the `sveltekit({...})` plugin call. Runes mode is forced there for all
  non-`node_modules` files.
- Reactive classes live in **`.svelte.ts`** files — `$state` in a plain `.ts` is a compile error.
  Hence `game.svelte.ts`.
- `role="application"` + `aria-label` is what silences `a11y_no_static_element_interactions` on a
  custom pointer-driven widget. It is a lint fix, not accessibility — real keyboard support is
  outstanding.

## Unused so far

The **server layer** — `+page.server.ts`, form actions, endpoints — is the main reason SvelteKit was
chosen and is not used yet. [[Opening Drills]] is what will need it.

Related: [[Stack (MOC)]] · [[pnpm]]
