---
status: accepted
date: 2026-09-16
tags: []
---
# Audited, and the findings fixed the same night

Two Fable agents audited the app at the owner's request — [[2026-09-16 Security audit|2026-09-16 — Security audit]] and
[[2026-09-16 Correctness audit|2026-09-16 — Correctness audit]] — and reported rather than fixed, with every confirmed finding carried
by a failing test.

**Security: nothing critical, nothing high.** Auth, authorisation, the admin gate, the CSP, the edge
cache and the service worker's never-cache invariant were all verified on the wire. The one medium was
the write API: no rate limit and no per-account quota, measured at 40,000 rows and 16 MB per request, so
one throwaway account filled the free tier in about 32 requests. Fixed with **a per-account ceiling of
200,000 rows** (the control that bounds the total, which is what the storage limit is about) and the
Workers rate-limit binding keyed by account rather than address. The quota answers 507, not a 4xx, so the
client keeps its rows and retries: a wrong number here must not throw a real person's progress away.

**Correctness: four medium, seven low.** The worst was the map — see [[Exploration Mode]], "What may be
named". The spoiler rule had been broken four times in one day in four different places, which is a
design fault and not four mistakes: the layout handed every consumer a whole `IndexedLine` and each could
read anything off it. It is one rule with one owner now, enforced in three layers.

All ten confirmed code findings are fixed. Two `it.fails` tests remain on purpose: one records a fact
about the shipped catalogue rather than a defect, the other prints the three positions where catalogued
theory takes a move the coach calls a mistake.
