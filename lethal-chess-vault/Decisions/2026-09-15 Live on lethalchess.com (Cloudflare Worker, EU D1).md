---
status: accepted
date: 2026-09-15
tags: []
---
# Live on lethalchess.com (Cloudflare Worker, EU D1)

The app replaced the Coming Soon page at 21:47. Setup, in the Cloudflare account that owns the zone
(a GitHub-login account — the first `wrangler login` went to a different, email-based account that
had no zone; nothing was created there):

- **D1 `lethal-chess` with `--jurisdiction eu`** — verified via API (`jurisdiction: eu`, running EEUR).
- **Secrets** `GOOGLE_CLIENT_ID/SECRET` via `wrangler secret bulk` from `.dev.vars`, never printed;
  the temp JSON was shredded.
- **Custom domains** `lethalchess.com` + `www.lethalchess.com` on the Worker; `www` 301-redirects to the
  apex in `hooks.server.ts` (sessions and the OAuth callback live on one host).
- **Cutover:** detached both domains from the `pre-lethalchess` Pages project; the Worker attach then
  failed because the Pages-era CNAME records still existed (wrangler's OAuth token has no DNS scope). The
  user deleted them in the dashboard; redeploy attached both. Downtime ~5 min. Rollback path: re-attach
  the domains to the Pages project.
- **Production-only bug found and fixed first on workers.dev:** SvelteKit's server-side `fetch` of a
  static path returns 404 inside the Worker (static files sit in the assets layer in front of it). Loads
  now use the `ASSETS` binding in production and Vite's fetch in dev (`src/lib/server/assets.ts`).

Verified on the live domain: all routes, 404/401 behaviour, TLS, www redirect with path and query, the
Google redirect URI. **Not yet verified: a real Google sign-in end to end** — needs the user.
