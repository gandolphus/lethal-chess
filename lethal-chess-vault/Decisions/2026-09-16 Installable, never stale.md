---
status: accepted
date: 2026-09-16
tags: []
---
# Installable, never stale

The owner wants the app on a phone's home screen without browser chrome. That takes a manifest, icons
and a service worker — and a service worker is exactly the thing that once served this owner stale pages.
So the worker's job is narrowed to installability and fast repeat loads ([[Installable app]]):
- **Pages are never cached.** Navigations aren't handled at all; they go to the network every time, where
  `hooks.server.ts` already answers with `no-cache` + ETag. A deploy is visible on the next load, with
  SvelteKit's version poll and reload banner unchanged.
- **One cache per build**, thrown away on activate, `skipWaiting` + `clients.claim`. Hashed
  `/_app/immutable` assets are cache-first because their names change with every build.
- **The engine (7 MB) is cache-first but never pinned.** Its file names don't change between releases, so
  a cached copy is carried into a new build's cache only when a HEAD request returns the same ETag.
  Production ETags are content hashes, so a deploy that didn't touch Stockfish costs two HEADs, and one
  that did costs one download. Chosen over stale-while-revalidate, which could pair an old `.wasm` with a
  new loader for one session.
- **Nothing personal enters the cache:** not `/api/*`, not `__data.json`, not anything cross-origin or
  non-GET, and no response marked `private` / `no-store`.
- **The mark** is the Monolith knight (the app's own piece), the accent bar its ground; kept from the
  owner's draft, with a contrastier checker and a bar thick enough to survive 48 px.
