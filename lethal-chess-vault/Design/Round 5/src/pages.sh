#!/usr/bin/env bash
# Before/after for the calm themes on more pages: every changed file at HEAD, shoot; this branch, shoot; diff.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
SRC="$ROOT/lethal-chess-vault/Design/Round 5/src"
SHOTS="$ROOT/lethal-chess-vault/Design/Round 5/shots"
FILES="src/app.css src/lib/components/Board.svelte src/lib/theme/ThemeSwatch.svelte src/lib/theme/settings.svelte.ts src/routes/+layout.svelte src/routes/settings/+page.svelte static/theme.js"
KEEP="$(mktemp -d)"
for f in $FILES; do mkdir -p "$KEEP/$(dirname "$f")"; cp "$ROOT/$f" "$KEEP/$f"; done
restore() { for f in $FILES; do cp "$KEEP/$f" "$ROOT/$f"; done; }
trap restore EXIT

for f in $FILES; do git -C "$ROOT" show "HEAD:$f" > "$ROOT/$f"; done
sleep 2
(cd "$SRC" && OUT="$SHOTS" TAG=head node pages.mjs >/dev/null)
restore
sleep 2
(cd "$SRC" && OUT="$SHOTS" TAG=now node pages.mjs >/dev/null)
(cd "$SRC" && node diff.mjs "$SHOTS" head now 2>/dev/null | grep -v "^\[" )
