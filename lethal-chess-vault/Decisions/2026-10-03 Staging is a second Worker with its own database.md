---
status: accepted
date: 2026-10-03
tags: [deploy, cloudflare]
---
# Staging is a second Worker with its own database

The owner tests from a phone while away, and the site now has a second real user, so changes should
be testable on the web without being deployed straight to production.

**Chosen:** a wrangler environment `staging` → Worker `lethal-chess-staging` on the custom domain
`staging.lethalchess.com`, with its own EU-jurisdiction D1 (`lethal-chess-staging`), its own
rate-limit namespace (1002), and the same Google OAuth client (redirect URI added for the subdomain).
A `STAGING` var makes the hook add a STAGING badge to every page and `X-Robots-Tag: noindex`.
Analytics stay production-only (they were already keyed on the canonical host). Access to the
subdomain is restricted to the owner with Cloudflare Access (dashboard-managed; the wrangler token
has no Access scope).

Flow: change → `pnpm cf:deploy:staging` → owner tests → `pnpm cf:deploy`.

**Rejected:**
- *Workers preview URLs / version aliases* — they bind the production D1, so testing writes real
  data and runs against real migrations; and they reopen the second origin that the soundness
  audit closed (`preview_urls: false`).
- *Deploying straight to production* — fine with one user, not with real users.
- *A staging branch on Cloudflare Pages* — the app is a Worker; would mean a second hosting setup.
