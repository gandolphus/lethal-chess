---
tags: [audit, security, fable]
aliases: [Security audit]
---

# 2026-09-16 — Security audit

Read-only security audit of `main` (f7a919d): [[Public MVP]] as deployed on lethalchess.com — Google
sign-in, sessions, the progress API, the admin page, input handling, headers and CSP, the service
worker of the [[Installable app]], client-side HTML sinks, and what stays in the browser. Correctness
is a separate audit. Follows [[2026-09-15 — Fable soundness audit]], whose security-relevant fixes
(body cap, sign-out keeps the outbox, `workers_dev` off) were re-checked and hold.

Evidence: every file under `src/lib/server`, `src/routes/auth`, `src/routes/api`, `src/routes/admin`,
`src/hooks.server.ts`, `src/service-worker.ts`, `src/lib/drill/*store*`, `src/lib/theme/pieces` and
the migrations was read in full. The production build (`pnpm build`, kit 2.70.3, svelte 5.57.0,
wrangler 4.131.2) was run in workerd (`wrangler dev --local`) against a scratch D1 seeded with three
users and hand-made session tokens, and probed with plain HTTP: headers, cross-user reads, the admin
gate, cross-site posts, malformed and oversized bodies, and a maximum-size import. `pnpm test` (419)
passes. Nothing was sent to the live site beyond ordinary page loads; the remote database was not
touched.

**Nothing critical or high was found.** There is no way found for one user to read or write another
user's rows, to forge or replay a session, to reach `/admin` without the owner's Google account, or
to run script in another user's page. The worst finding is the known one: the write API has no rate
limit and no per-user quota, so one free Google account can fill the database in minutes.

| # | Sev | Status | Finding |
|---|---|---|---|
| 1 | medium | CONFIRMED | No rate limit or per-user quota: one account fills D1 in ~30 requests (free tier) and takes every user's sync down with it |
| 2 | low | CONFIRMED | Sessions never expire while used, and a user cannot revoke them from elsewhere |
| 3 | low | CONFIRMED | A previous account's local progress survives on a shared browser when the next sign-in skips sign-out |
| 4 | low | CONFIRMED | `bundleId` is not checked against the shipped openings, so rows and admin statistics accept any slug |
| 5 | info | CONFIRMED | `_headers` lags `SECURITY_HEADERS`; static SVG documents carry no CSP; HSTS is not `includeSubDomains`/`preload`; the cookie has no `__Host-` prefix |
| 6 | info | CONFIRMED | `pnpm cf:preview` redirect-loops: the hook's local-host check does not match what wrangler's proxy sends |
| 7 | info | CONFIRMED | One dependency advisory (`cookie` 0.6.0 under `@sveltejs/kit`), not reachable from this app |
| S1 | low | NOT CONFIRMED | Anyone holding their own state cookie can make the Worker POST to Google's token endpoint at will |

---

## 1 · No rate limit or quota on the write API

**medium · CONFIRMED** · `src/routes/api/progress/import/+server.ts:7-10,18`,
`src/lib/server/http.ts:49-60`, `src/lib/server/progress.ts:10,94-110`, `src/lib/server/stats.ts:29-62`

`POST /api/progress/import` takes an 8 MB body holding up to 20,000 attempts, 10,000 cards, 10,000
discoveries and 20,000 reviews, and `importProgress` writes all of it in one `db.batch`. Nothing
counts what a user already has, nothing limits how often they may call, and the natural keys
(`at` to the millisecond, `attemptNo` up to 1000, `bundleId` any slug, see § 4) make every row unique
at the caller's choice. Measured against the built Worker and local D1: one 7.2 MB request with
20,000 attempts and 20,000 reviews returned 200 in **1.46 s** and grew the database by **16 MB**
(about 400 bytes a row with its indexes).

What an attacker gets: with one Google account, a D1 database at Cloudflare's limit — 500 MB on the
free plan is about 32 such requests, 10 GB on the paid plan about 640, both minutes of scripting.
A full database rejects every write, so every signed-in learner's outbox stalls at "offline" until
the rows are removed by hand; on the paid plan the same script is a bill (rows written and read).
Before the limit, the admin page suffers: `siteStats` runs `COUNT(DISTINCT user_id)` over a
`UNION ALL` of three tables and an untimed `COUNT(*)` over every practice attempt, so `/admin`
slows and then times out as the tables bloat. The attacker's own `GET /api/progress/[bundleId]` and
export (no `LIMIT`, whole account in memory) break only for them.

What it needs: a Google account and a session cookie, both free; no other user's involvement.

Fix, in order of leverage:
- **A per-user quota** enforced in `importProgress`: count the user's rows (one indexed `COUNT` per
  table, or a `user_totals` row maintained in the same batch) and refuse an import that would pass a
  ceiling that no honest learner reaches (28 openings × a few thousand attempts is well under 200k
  rows). This is the only control that bounds the *total*, which is what the storage limit is about.
- **A rate limit** in front of the API: a Cloudflare WAF rate-limiting rule on `lethalchess.com/api/*`
  keyed by IP (zone-level, one rule is on the free plan), or the Workers Rate Limiting binding keyed by
  `user.id` inside `authed()`. Either turns "minutes" into "days".
- Lower the per-request maxima now that the outbox sends 500 at a time (System Map): 20,000-row
  requests exist only for the first import of a long signed-out history, which 500-row batches
  already handle.
- Bound `siteStats`: put a time window on the practice `COUNT`, and give `stats.ts` its own index or
  a nightly rollup once there are real numbers.

Listed already as a gap in [[System Map]] and the [[Public MVP]] backlog; this entry sizes it.

## 2 · Sessions never expire while used, and cannot be revoked from elsewhere

**low · CONFIRMED** · `src/lib/server/session.ts:11-13,69-73`, `migrations/0001_init.sql:15-19`,
`src/routes/auth/google/callback/+server.ts:44`

A session is renewed to a full 30 days whenever it is used with fewer than 15 left, and the row has
no `created_at`, so there is no ceiling: a cookie used every fortnight is valid forever. A session
is invalidated only by its own sign-out, by the sign-in that replaces it *in the same browser*
(`callback/+server.ts:44` deletes `locals.session`, not the user's other sessions), or by account
deletion. Signing in on a new device does not sign the old one out, and there is no "sign out
everywhere".

What an attacker gets: a cookie copied once from an unlocked device (or a synced browser profile)
stays valid as long as they keep using it, and the owner has no way to end it short of deleting
the account. Sensitivity is low — the account holds opening practice, not money — which is why this
is low and not medium.

Fix: add `created_at` to `sessions` and refuse renewal past an absolute age (90 days is usual); add a
"Sign out of all devices" action in Settings (`DELETE FROM sessions WHERE user_id = ?`, then issue a
fresh session for the caller). While there, purge expired rows for *everyone* on sign-in, not only for
the signing-in user (`createSession` deletes only that user's), so the table does not accumulate.

## 3 · A previous account's local progress survives a sign-in that skipped sign-out

**low · CONFIRMED** · `src/routes/+layout.svelte:34-54,57-65`, `src/routes/auth/google/callback/+server.ts:44-48`,
`src/lib/drill/synced-store.ts:77-79`

Sign-out removes `lethal:user:<id>:*` from localStorage (keeping the outbox on purpose — [[Decision
Log]] 2026-09-15). Two paths skip that code:
- **Sign in as another Google account without signing out.** `/auth/google` is reachable while
  signed in; the callback replaces the session and the layout effect simply switches the store to the
  new `user.id`. The old account's `lethal:user:<old>:*` keys stay, readable by the new person from
  devtools or by any later page that iterates keys.
- **The form's JS handler did not run** (JS off, or the page failed to hydrate): the plain POST signs
  out and leaves the copy. Sessions ended elsewhere (expiry, deletion from another device) also leave
  it, but that is inherent.

By design the outbox stays after sign-out, and it holds attempts and line reviews with EPDs and
timestamps — which openings the person studied and when. That is the whole of what leaks: no name,
email or token is ever written to localStorage (checked: every `lethal:` key is progress or the
validated appearance record).

Fix: in the layout effect that switches stores, remove every `lethal:user:*` namespace whose id is not
the current user's (keep outboxes if the "uploads next sign-in" promise is to be kept, else drop
those too); the same sweep on the settings page's delete path. That covers both paths above and the
session-ended-elsewhere case on the next sign-in.

## 4 · `bundleId` is not checked against the shipped openings

**low · CONFIRMED** · `src/lib/server/validate.ts:31,38-41`, `src/lib/server/stats.ts:49-55`,
`src/routes/admin/+page.svelte`

The validator accepts any `[a-z0-9-]{1,64}` slug; `zz-not-an-opening` was stored and read back.
Consequences: an unbounded number of namespaces per user (feeds § 1), and the admin page's "top
openings" table lists whatever slugs the busiest account chose to write — escaped by Svelte, so text
only, but the owner's dashboard can be made to say anything spellable in lowercase and hyphens.

Fix: load `static/openings/repertoires/index.json` once per isolate through the `ASSETS` binding
(`fetchStatic`) and reject ids not in it; the client already only ever sends ids from that index.

## 5 · Header drift and hardening left on the table

**informational · CONFIRMED** · `static/_headers:3-7`, `src/hooks.server.ts:12-19`, `src/lib/server/session.ts:88`

- `_headers` (assets layer) lacks `permissions-policy`; the Worker sends it. The comment in
  `_headers` asks for the two to be kept in step.
- No CSP reaches static documents. Only SVGs rendered as top-level documents matter
  (`/favicon.svg`, `/icons/*.svg`); all are authored in the repo, so this is hygiene, not exposure.
  Adding `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'` for `/icons/*` and
  `/favicon.svg` in `_headers` closes it.
- HSTS is six months without `includeSubDomains` or `preload`, deliberately (comment at
  `hooks.server.ts:13`). `www` already lives on the Worker over HTTPS, so `includeSubDomains` is
  safe once no other subdomain is served plain.
- The session cookie is `session`, not `__Host-session`. The flags it does carry (`HttpOnly; Secure;
  SameSite=Lax; Path=/`, no `Domain`) are exactly what the prefix would enforce; the prefix makes a
  subdomain unable to plant one. Rename when convenient (it signs everyone out once).
- No `Cross-Origin-Opener-Policy`. Nothing here needs it; noted for completeness.

## 6 · `pnpm cf:preview` redirect-loops

**informational · CONFIRMED** · `src/hooks.server.ts:25,31`, `package.json` (`cf:preview`)

The hook redirects plain `http:` to `https://lethalchess.com` unless the hostname is `localhost` or
`127.0.0.1`. Under `wrangler dev` 4.131 the Worker sees a request whose hostname is neither and whose
protocol is `http:`, and wrangler's proxy rewrites the `Location` back to `http://localhost:8787/…`,
so every SvelteKit-handled request answers **301 to itself** (assets still serve, because they bypass
the hook). `wrangler dev --local-protocol https` avoids it and is how this audit ran the build. Not a
production issue — the Worker only ever receives its two custom domains over HTTPS — but the documented
preview command does not work as written.

## 7 · Dependency advisory

**informational · CONFIRMED** · `pnpm audit`: 1 low, 0 others

`cookie@0.6.0` (GHSA-pxg6-pf52-xh8x: `serialize` accepts out-of-bounds characters in name, path and
domain) via `@sveltejs/kit`. Reachable only when untrusted input becomes a cookie name or path; this
app uses the constants `session`, `google_oauth_state`, `google_code_verifier`, `/` and
`/auth/google`. Resolved by the next kit release that moves to `cookie` ≥ 0.7.

---

## Suspicions not confirmed

**S1 · The callback can be made to call Google's token endpoint on demand** · low ·
`src/routes/auth/google/callback/+server.ts:19-34`, `src/lib/server/google.ts:76-104`

Anyone can start the flow, keep the resulting state cookie, and then hit the callback with that
`state` and any `code`; each hit makes the Worker POST the client secret and the junk code to
`oauth2.googleapis.com` (10 s timeout, `redirect: 'manual'`). Whether Google throttles the client id
after a flood of bad exchanges, and so blocks sign-in for everyone, was not tested (it would mean
attacking Google, not this app). The cost to the Worker itself is one outbound request per hit and no
database work. A rate limit on `/auth/*` (the same WAF rule as § 1, or a stricter one) removes the
question.

---

## Verified fine

Things that look alarming and are not, so the owner does not have to wonder.

- **The Google ID token is not signature-checked.** Correct: it is obtained directly from Google's
  token endpoint over TLS with the client secret (OIDC Core 3.1.3.7 allows skipping the signature in
  that case), and `parseGoogleIdToken` checks `iss`, `aud` (array-aware), `exp`, `sub` and requires
  `email_verified === true`. The secret never leaves the body of that one request; `redirect:
  'manual'` stops it following anything.
- **OAuth `state` and PKCE.** 256-bit state compared to an `HttpOnly; SameSite=Lax` cookie scoped to
  `/auth/google` with a 10-minute life; both cookies are deleted before any check ("one-shot"). PKCE
  S256 with a 43-character verifier. A login-CSRF attempt fails because the attacker cannot plant the
  matching state cookie. No open redirect: the callback goes to `/` or `/?signin=cancelled`.
- **Sessions.** 32 random bytes in the cookie; only the SHA-256 in the table, so a leaked `sessions`
  table is worthless; pattern-checked before hashing; fresh token on every sign-in (no fixation);
  the prior session in that browser is invalidated; expired rows are deleted on sight; a bogus cookie
  is cleared (`Set-Cookie: session=; Max-Age=0`, tested); `HttpOnly; Secure; SameSite=Lax` (Secure is
  kit's default off `localhost`). Sign-out is POST-only behind kit's origin check.
- **Authorisation.** Every `/api/**` handler is wrapped in `authed()`, which takes the user from
  `locals` and nothing else; a body carrying `userId`/`user_id` is ignored (tested); every SQL statement
  binds `user.id`. With two seeded users, Bob's `/api/progress/ruy-lopez` and `/api/account/export`
  showed none of Alice's rows. Account delete is scoped to the caller and needs the phrase.
- **Admin.** `isAdmin` runs server-side in the page load on the session's Google-verified email,
  case-insensitively; anonymous and non-owner get 404, the owner email 200 (tested). The `isAdmin`
  flag in layout data only decides whether to draw the link.
- **SQL.** Everything is parameterised; batches go in as one JSON string per statement and are
  unpacked with `json_each`; card state is rebuilt from a whitelist so `__proto__` and stray keys are
  dropped (tested); `STRICT` tables with `CHECK` constraints stand behind the validator.
- **Input.** Body caps of 256 KB / 512 KB / 8 MB / 1 KB, enforced while streaming (300 KB → 413,
  tested); list lengths bounded; EPD, UCI, ISO-8601 and slug regexes; integers range-checked;
  `application/json` required (415), which forces a CORS preflight the app never answers, so a
  cross-site page cannot reach any JSON endpoint; kit's origin check rejects cross-site form posts
  (403, tested), so neither logout nor delete can be CSRF'd; `SameSite=Lax` is the second layer.
- **CSP.** The production Worker sends `content-security-policy` in hash mode: one hash for kit's
  bootstrap, `theme.js` is an external file so scripts need no `unsafe-inline`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` (plus `X-Frame-Options: DENY`),
  `connect-src` limited to self and Cloudflare Insights, `img-src` to self, `data:` and Google
  avatars. `style-src 'unsafe-inline'` is the one relaxation, needed by the piece sprites, and cannot
  run code. The analytics beacon the hook injects matches the `script-src` host entry. Nothing
  defeats it.
- **Edge cache.** The adapter's worktop layer stores only a response whose `cache-control` is present
  and free of `private`/`no-cache`/`no-store` with status < 400. The hook gives signed-in responses
  `private, no-store`, signed-out pages `no-cache`, kit gives `__data.json` `private, no-store`, and
  `authed()` gives every API response `private, no-store` (all verified on the wire). No personal
  response can be cached at the edge or served to another visitor.
- **Service worker.** The invariant holds against the code: navigations and non-GETs return before any
  cache logic; cross-origin, `Authorization`, `__data.json` and every path outside the explicit
  prefix list (which does not include `/api/`) are untouched; `storable` also refuses non-`basic`,
  non-2xx, `private` and `no-store` responses. What it caches is hashed assets, the engine, icons,
  the manifest, `theme.js` and the public opening bundles.
- **HTML sinks.** The only `innerHTML` is the piece sprite, whose markup comes from in-repo code
  (`customSprite`) or Vite `?raw` imports of repo SVG files at build time (`importedSprite`), gated by
  `isSvgSet`; no runtime value reaches it. There is no `{@html}` anywhere. `user.name` and email render
  as text; `user.picture` is `https://`-only, 2 KB max, constrained by `img-src`, and sent with
  `referrerpolicy="no-referrer"`. The error page reflects nothing.
- **Secrets.** `.dev.vars` is gitignored and has never been committed (history checked);
  `.dev.vars.example` holds placeholders; secrets are read only through `platform.env` in server
  code; the built client bundle contains no secret-shaped strings; the Insights token is public by
  design. `wrangler.jsonc` turns invocation logs off, so callback `code`s are not logged, and there is
  no `console.*` in server code.
- **Errors.** API errors name the field, never the value; unexpected errors reach kit's generic 500;
  the 503 for missing OAuth config names only the example file.
- **Paths.** `params.id` is matched against the opening index before it is used to build a path;
  `bundleId` is regex-bound. `workers_dev` and `preview_urls` are off, so there is one origin.

## What was not done

- No end-to-end Google sign-in (no secrets in the audit worktree, and the flow's checks are all in
  code that was read and unit-tested by `google.test.ts` / `session.test.ts`).
- No test against the live site or the remote database, by the owner's rule.
- Load behaviour of D1 at its storage limit is taken from Cloudflare's documentation, not observed.
