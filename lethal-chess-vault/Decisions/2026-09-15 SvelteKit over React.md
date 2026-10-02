---
status: accepted
date: 2026-09-15
tags: []
---
# SvelteKit over React

Considered React 19 (continuity with the analyzer prototype, `react-chessboard`, react-three-fiber)
against SvelteKit. Chose **SvelteKit + Svelte 5 runes** because:

1. **Built-in server layer.** Drilling needs persistence and eventually the Lichess failure-rate
   data. SvelteKit gives routing + server endpoints in one thing; the React path means React Router
   plus a separate backend, which is exactly what the old prototype did.
2. **Less ceremony for state machines.** A drill *is* a state machine
   (present → await → judge → feedback → advance). Runes express that without
   `useEffect`/`useCallback`/dependency arrays; worker lifecycle especially.
3. Smaller runtime, scoped CSS.

**Explicitly not a factor: rendering performance.** A 64-square board is nothing; VDOM overhead here
is unmeasurable. Rejecting React on "no virtual DOM" grounds would have been a non-reason.

**What we gave up:** react-three-fiber. If the tree visualization ever wants declarative 3D, Svelte's
Threlte is smaller-ecosystem. Judged acceptable — see the next entry.
