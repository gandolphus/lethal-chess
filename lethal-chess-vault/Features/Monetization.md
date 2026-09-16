---
tags: [business, monetization]
aliases: [Monetization, Pricing]
---

# Monetization

**Status: discussion 2026-09-16, nothing decided.** See [[Your games]] for the feature this is built on.

## The shape of the problem

The engine runs in the browser, so marginal cost per user is close to zero (Workers requests, D1 rows). A
generous free tier is affordable, and "more compute" cannot be the thing people pay for. What is scarce is
memory across devices, curation, and other people's attention on a learner's progress.

## Options, best first

1. **Free to use, paid account.** Free: explore and review on one device. Paid: sync, full history,
   unlimited openings, PGN import, and the [[Your games]] loop. ~40–60 SEK/month, a year for the price of
   eight months.
2. **Coaches and clubs.** A coach assigns a repertoire and sees which lines each student has found and
   keeps forgetting — the line map per student. Higher willingness to pay, bought per group, and nobody
   else shows this.
3. **Lifetime licence sold early,** capped, to fund the work and recruit the people who shape it.
4. **Authored packs** with revenue share, once an author tool exists (Chessable's model).
5. **Donations.** A quiet link, not a plan.
6. **Ads — no.** They would wreck the thing the owner cares most about.

## Constraints

- **AGPL does not stop charging.** The source stays public and anyone may self-host; the moat is the
  hosted account, curation and speed — not secrecy.
- **Stockfish is GPL.** Shipping it to the browser is distribution; running it on a server is not.
  Anything to be kept closed belongs server-side.
- **Swedish VAT.** Selling to EU consumers needs VAT handling: use a merchant of record (Paddle, Lemon
  Squeezy) rather than bare Stripe, and an enskild firma before taking money.

## Agreed next step

Don't build billing. Ship the free scan, get five to ten real users, watch day-7 return, and ask the ones
who come back what they would pay for.
