#!/usr/bin/env bash
# Usage: shots.sh [name=hashparams ...]   (default: one per theme, drill state, monolith pieces)
D="$(dirname "$0")"
cd "$D" && node build.mjs >/dev/null
if [ $# -eq 0 ]; then
  set -- obsidian=theme=obsidian ember=theme=ember abyss=theme=abyss moss=theme=moss paper=theme=paper gallery=theme=gallery porcelain=theme=porcelain
fi
for spec in "$@"; do
  name=${spec%%=*}; hash=${spec#*=}
  firefox --headless --profile "$D/ffprofile" -no-remote --window-size=1400,900 \
    --screenshot "$D/shots/$name.png" "file://$D/prototype.html#$hash&nomotion=1" >/dev/null 2>&1
  echo "$D/shots/$name.png"
done
