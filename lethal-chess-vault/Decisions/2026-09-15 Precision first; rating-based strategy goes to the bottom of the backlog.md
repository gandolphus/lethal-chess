---
status: accepted
date: 2026-09-15
tags: []
---
# Precision first; rating-based strategy goes to the bottom of the backlog

User direction: "Forget about my rating. We're doing a serious tool first and foremost, not a hacky
one. I want to get super proficient first." The first rollout is built on **objective engine truth
only**. Everything keyed to a rating band — practical edge, "what players at your level get wrong",
frequency by band — is deferred indefinitely ("maybe").

Consequences:
- The **30 GB game dump is not needed** for the first rollout. The **22 GB eval db is**.
- "Common responses" can no longer mean "frequent at your band". Replaced by
  **engine-sound replies ∪ catalog-named replies** — the catalog lists the dubious-but-real lines
  people actually play (Wing Gambit, Morra, …), which covers what a frequency filter would have
  caught, without any rating assumption.
- The strength model in [[Opening Classification]] keeps *objective cost* and drops *practical edge*
  for now.
