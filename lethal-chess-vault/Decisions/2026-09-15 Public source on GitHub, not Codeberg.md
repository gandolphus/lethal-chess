---
status: accepted
date: 2026-09-15
tags: []
---
# Public source on GitHub, not Codeberg

AGPL requires public source. The user suggested Codeberg (`dafroggy`), but Codeberg's terms of use
(§7, adopted 2026-07-23 by member vote) forbid sharing "projects that mostly consist of code written by
'generative AI'-tools (including services such as Claude…)" — which this project is. A public Codeberg
repo could be removed, taking AGPL compliance with it. (Private Codeberg repos remain fine, consistent
with the system vault's earlier reading.)

Published at **github.com/gandolphus/lethal-chess** (public, AGPL-3.0 detected by GitHub), first
commit `af7b084`. The vault is public too — scanned first: no emails, keys or tokens; temp paths
scrubbed. Commits use GitHub's no-reply address (repo-local config) so no email is exposed. Before the
push, a secret scan ran over exactly the 246 committed files; `.dev.vars`, `data/`, `static/engine/`
verified gitignored.
