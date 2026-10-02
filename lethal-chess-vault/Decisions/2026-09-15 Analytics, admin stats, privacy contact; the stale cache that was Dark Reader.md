---
status: accepted
date: 2026-09-15
tags: []
---
# Analytics, admin stats, privacy contact; the "stale cache" that was Dark Reader

- **Cloudflare Web Analytics** (cookieless) injected by `hooks.server.ts` on the canonical host only;
  CSP allows `static.cloudflareinsights.com` / `cloudflareinsights.com`. Real-visitor numbers live there,
  not in DNS/traffic tabs (bots, certificate-log scanners and our own testing dominate those).
- **`/admin`** — aggregate learner stats (accounts, active learners, moves per day, top openings), 404 for
  everyone except `gandolphius@gmail.com` (`src/lib/server/stats.ts`).
- **Privacy contact `privacy@lethalchess.com`** via Cloudflare Email Routing → gandolphius@gmail.com.
  Required deleting Porkbun's forwarding MX/SPF records (user did); test email verified delivered.
  Privacy page rewritten: controller contact, analytics, processors, legal basis, retention, rights, IMY.
- **Never serve stale versions:** pages sent `Cache-Control: no-cache`; `version.pollInterval` makes open
  tabs detect deploys and offer a reload.
- **Lesson:** "production shows old pieces, private window is correct" was the **Dark Reader** extension
  recolouring SVG outlines (extensions are off in private windows). Proven by rendering production and
  localhost byte-identical, then a console diagnostic from the affected window. Fix: `<meta
  name="darkreader-lock">` + `color-scheme` meta so extensions and forced dark modes leave the site's own
  themes alone. Check for colour-altering extensions *first* next time appearance differs per window.
