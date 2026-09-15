# CODEX · src/lib/server

**Purpose:** Server-only auth and persistence for the Cloudflare Workers deployment — Google sign-in,
database sessions, and the per-user progress log in D1.
**Owned by:** src/lib/server (plus `src/hooks.server.ts`, `src/routes/auth/**`, `src/routes/api/**`,
`src/routes/+layout.server.ts`, `src/lib/drill/server-store.ts`, `migrations/`, `wrangler.jsonc`).
**Exposes:** `event.locals.user` / `event.locals.session`; root layout data `{ user: { id, name, email, picture } | null }`;
the JSON API below; `ServerProgressStore` (client side, in `$lib/drill/server-store`).
**Depends on:** Cloudflare D1 (`platform.env.DB`), Web Crypto + fetch (Google OAuth/OIDC with PKCE, vendored from Arctic's 0BSD example code). No Node APIs, no `nodejs_compat`.

## Contents
| Name | Purpose |
|------|---------|
| db.ts | `Database` — the slice of D1's API used (`prepare/bind/first/all/run`, `batch`). D1Database satisfies it structurally. |
| session.ts | Lucia-style sessions: 32-byte base64url token in cookie `session`, SHA-256 hex as the row id, 30-day TTL, renewed to 30 days when < 15 remain. |
| users.ts | `upsertGoogleUser` keyed by Google `sub`; refreshes email/name/picture on each sign-in. |
| google.ts | OAuth code flow: state, PKCE S256, authorization URL, token exchange (`TokenRequestRejected` → 400, `TokenEndpointFailure` → 502), `parseGoogleIdToken` (iss, aud, exp, sub, verified email). |
| encoding.ts | base64url encode/decode, random tokens. |
| validate.ts | Strict parsers for attempts, card states (known ts-fsrs fields only), bundle ids, EPDs, UCI moves. |
| progress.ts | Repository: `recordAttempts` (idempotent), `saveCards` (last write wins), `importProgress` (idempotent, newer review wins), `loadProgress`. |
| http.ts | `authed()` wrapper (401 / 503 / 400 mapping, `private, no-store`), `readJson` (requires application/json, size cap). |
| test-db.ts, test-event.ts | Test only. node:sqlite running the real migrations; fake RequestEvent/Cookies. Never import from app code. |

## API
| Route | Body / result |
|-------|---------------|
| `GET /auth/google` | 302 to Google (state + PKCE verifier in 10-min httpOnly cookies); 503 if secrets are missing. |
| `GET /auth/google/callback` | Checks state, exchanges code, validates ID token, upserts user, new session, 302 `/`. 400 on any mismatch. |
| `POST /auth/logout` | Deletes the session, clears the cookie, 303 `/`. |
| `GET /api/progress/[bundleId]` | `{ cards: { [epd]: CardState }, attempts: Attempt[] }` (dates as ISO strings, attempts oldest first). |
| `POST /api/attempts` | `{ attempts: Attempt[] }` (1–500) → `{ inserted }`. Re-sending is harmless. |
| `PUT /api/cards` | `{ cards: { bundleId, epd, state }[] }` (1–500) → `{ saved }`. |
| `POST /api/progress/import` | `{ attempts?, cards? }` (≤ 20k / 10k) → `{ importedAttempts, cards }`. Atomic, repeatable. |

## Conventions
- The user id always comes from the session, never the request body.
- Attempt identity is its natural key `(user, bundle, at, epd, attemptNo)` — there is no client id.
- Rows are sent as one JSON parameter per statement and unpacked with `json_each` (D1 allows 100 bound parameters).
- Every table is `STRICT`; migrations are append-only files in `migrations/` (never edit an applied one).
- The adapter's Worker checks the Cache API *before* running SvelteKit and stores any response with a
  non-private `Cache-Control`. The root layout is per-user, so pages must not set public cache headers;
  the hook forces `private, no-store` for signed-in responses.
- Local dev: `pnpm db:migrate:local` once, then `pnpm dev` (the adapter's platform proxy gives `platform.env.DB`
  from `.wrangler/state` and secrets from `.dev.vars`). `pnpm cf:preview` runs the built Worker in workerd.
