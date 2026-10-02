---
status: accepted
date: 2026-09-15
tags: []
---
# OAuth without Arctic: vendored Google flow on fetch + Web Crypto

Arctic and most `@oslojs/*` packages were deprecated by their author on 2026-07-29 (his blog post; the
repository's `/code` examples are the recommended replacement). Verified the deprecation was deliberate,
not a compromise. Auth is security-critical, so no unmaintained dependency: `src/lib/server/google.ts`
implements state + PKCE (S256 checked against the RFC 7636 test vector), token exchange (no redirect
following, 10 s timeout), and ID-token claim checks. Hand-rolled database sessions (SHA-256-hashed
tokens, 30-day sliding) unchanged. See `src/lib/server/CODEX.md`.
