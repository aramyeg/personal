#!/usr/bin/env bash
# s7 PIECE DECOMPOSITION (memory law: identify pieces by decomposition, never by
# prominence). The blind report's elements #19 (spiky starburst) and #20 (gold
# sawtooth tabs) are unidentified. This drops ONE ch6 layer at a time out of
# content.ts, lets the dev server hot-reload, and captures the spine crop, so a
# diff against the full frame names the pixels each piece actually owns.
#
# usage: bash .superpowers/sdd/bench/e3w2s7-decompose.sh
set -euo pipefail
ROOT="C:/Users/GBM/Documents/Projects/personal/.claude/worktrees/e3w2-s7"
CONTENT="$ROOT/components/labs/storybook/content.ts"
OUT="$ROOT/.superpowers/sdd/bench/out/e3w2s7/decompose"
mkdir -p "$OUT"
cp "$CONTENT" "$CONTENT.decomp-bak"
trap 'cp "$CONTENT.decomp-bak" "$CONTENT"; rm -f "$CONTENT.decomp-bak"' EXIT

for ID in ch6-crest ch6-steps ch6-strongbox ch6-strongbox-seal; do
  cp "$CONTENT.decomp-bak" "$CONTENT"
  # comment out the single-line layer literal whose id is $ID (ch6 block only)
  perl -pi -e "s|^(\s*)(\{ id: '$ID',)|\$1// DECOMP-OFF \$2|" "$CONTENT"
  grep -q "DECOMP-OFF { id: '$ID'" "$CONTENT" || { echo "MISS $ID"; continue; }
  sleep 6
  node "$ROOT/.superpowers/sdd/bench/e3w2s7-shot.mjs" "decompose/off-$ID" 3167
done
cp "$CONTENT.decomp-bak" "$CONTENT"
sleep 6
node "$ROOT/.superpowers/sdd/bench/e3w2s7-shot.mjs" "decompose/all" 3167
echo DONE
