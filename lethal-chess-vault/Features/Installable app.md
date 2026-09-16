---
tags: [feature, built, launch, pwa]
aliases: [Installable app, PWA, Home screen]
---

# Installable app

**Status: built (2026-09-16).** lethalchess.com installs to a phone's home screen and opens without
browser chrome. Part of the [[Public MVP]]; rationale in [[Decision Log]] 2026-09-16 "Installable, never stale".

## What ships

- **Mark.** The app's own Monolith knight ([[Visual Design]]) on two squares of a board, the Obsidian
  accent as its ground. `static/icons/icon.svg` (rounded, transparent corners) and `icon-maskable.svg`
  (full bleed, mark inside the 80 % safe circle) are the sources; the PNGs — 192, 512, maskable 512,
  Apple touch 180 — are rendered from them with headless Chromium over CDP (`--screenshot` pads the
  viewport; a CDP clip does not). `static/favicon.svg` is the knight alone, large enough for 16 px, with
  `favicon.png` / `favicon.ico` (a PNG in an ICO wrapper) as the fallback.
- **`static/manifest.webmanifest`.** "Lethal Chess" / "Lethal", standalone, `id` and scope `/`,
  `#131316` for background and theme, any orientation. Cloudflare's assets layer serves it as
  `application/manifest+json` unaided; `_headers` gives it and `service-worker.js` `no-cache`.
- **`src/app.html`.** Manifest link, `theme-color`, the icon links, the `apple-mobile-web-app-*` metas,
  and `viewport-fit=cover` with `env(safe-area-inset-*)` padding on `<body>` so the board is neither
  under the notch nor the home indicator. The root layout re-points `theme-color` at the active theme's
  `--bg`, so the status bar follows the theme.
- **`src/service-worker.ts`.** Registered by SvelteKit in production builds only. One cache per build.

## What the worker caches, and what it never does

| Request | Policy |
|---|---|
| Navigations (every page) | **Not handled.** The browser goes to the network; the hook's `no-cache` + ETag keeps it a 304. |
| `/_app/immutable/*` | Precached on install; cache first (hashed names). |
| `/engine/*` (Stockfish, 7 MB) | Cache first. On activate, carried into the new build's cache only if a HEAD shows the same ETag. |
| Icons, favicon, manifest, `/openings/repertoires/*` | Network, with the last copy when offline. |
| `/api/*`, `__data.json`, cross-origin, non-GET, `Authorization` | **Never touched.** Responses marked `private` / `no-store` are never stored either. |

Verified on `wrangler dev` (local, `--host 127.0.0.1`, or the canonical-host redirect loops): worker
activates and controls the page; 77 precached entries, 0 HTML; page reloads reach the Worker (200/304);
a rebuild swaps the cache and carries both engine files over (2 HEAD requests, 7,295,411 bytes kept);
`__data.json` and `/api/` fetches leave nothing behind. Local ETags include the file's mtime, so the
carry-over only shows with pinned mtimes; `wrangler deploy` hashes contents, so production ETags only
change when the engine does.

## Known gaps

- The opening page's sticky board column (`top: 1rem`) can slide under a translucent iOS status bar on
  scroll: it wants `top: calc(1rem + env(safe-area-inset-top))`.
- Offline, a navigation shows the browser's offline page. Deliberate: no page is ever served from a cache.
