---
status: accepted
date: 2026-09-16
tags: []
---
# Themes are families with a dark and a light side

The owner: the theme list should stop exposing "Round 1 / Round 2", every theme should have a dark and a
light version, and Dark / Light should be its own setting that flips the previews, "since most people are
likely looking for either a dark or a light theme". So ([[Visual Design]]):
- **Eight families**, each `{ dark, light }` over one board treatment: Stone (Obsidian / Gallery), Timber
  (Ember / Paper), Tide (Abyss / Porcelain), Grove (Moss / Sage), Material (Onyx / Alabaster), Instrument
  (Graphite / Vellum), Nocturne (Night / Dawn), Fabulous (Amethyst / Wisteria). The four flat pairings go
  by temperature: neutral, warm wood, cool blue, green. Moss had no light side, so **Sage** was drawn.
- **Order is deliberate**, quiet to loud: flat boards first (the default lives there), then the
  structural boards by how far they depart from a plain board, Fabulous last.
- **Mode is stored apart from the family.** Default: `prefers-color-scheme` until a mode is chosen; only a
  chosen mode is written, so an untouched visitor keeps following the device. Chosen over always-dark
  (the old default), since half the audience is looking for a light theme.
- **Compatibility.** Palette ids are unchanged. A stored `{theme}` from before maps to family + mode on
  load; `?theme=night` keeps working (it sets both); `?mode=` is new and flips the stored family. Unknown
  ids are dropped, never thrown on. Nine tests cover this.
- **Not done:** no live reaction to the device flipping its scheme mid-session; a chosen mode sticks.
