#!/usr/bin/env bash
# Which changed file moves pixels on a page of a calm theme? Each file is put back to HEAD in turn (the dev
# server reloads), the page is shot, and the shot is compared with the `head` shot of the same page.
# PAGE=/?theme=obsidian NAME=picker-obsidian bash bisect.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
SRC="$ROOT/lethal-chess-vault/Design/Round 5/src"
SHOTS="$ROOT/lethal-chess-vault/Design/Round 5/shots"
PAGE="${PAGE:-/settings/preview?theme=obsidian&pieces=monolith}"
NAME="${NAME:-preview-obsidian}"
FILES="src/app.css src/lib/components/Board.svelte src/lib/theme/ThemeSwatch.svelte src/lib/theme/settings.svelte.ts src/routes/+layout.svelte src/routes/settings/+page.svelte static/theme.js"
KEEP="$(mktemp -d)"
for f in $FILES; do mkdir -p "$KEEP/$(dirname "$f")"; cp "$ROOT/$f" "$KEEP/$f"; done
restore() { for f in $FILES; do cp "$KEEP/$f" "$ROOT/$f"; done; }
trap restore EXIT

shoot() { sleep 1.5; (cd "$SRC" && OUT="$SHOTS" TAG="$1" PAGE="$PAGE" NAME="$NAME" AT="${AT:-}" node one.mjs); }

for f in $FILES; do git -C "$ROOT" show "HEAD:$f" > "$ROOT/$f"; done
shoot head
restore
shoot now
for f in $FILES; do
	git -C "$ROOT" show "HEAD:$f" > "$ROOT/$f"
	shoot "bisect-$(basename "$f" | tr . -)-at-head"
	restore
done
cd "$SRC"
for tag in now bisect-app-css-at-head bisect-Board-svelte-at-head bisect-ThemeSwatch-svelte-at-head bisect-settings-svelte-ts-at-head bisect-+layout-svelte-at-head bisect-+page-svelte-at-head bisect-theme-js-at-head; do
	echo "== $tag vs head"; node diff.mjs "$SHOTS" head "$tag" 2>/dev/null | grep "$NAME" || true
done
