#!/usr/bin/env bash
# Lädt eine PixelLab-Figur als ZIP und entpackt sie nach art/chars/<kind>/
# Aufruf: bash tools/fetch_character.sh <kind p|n|b|r|q|k> <character-id>
# Handgepflegte Steuerdateien (SKIP, REMAP, IMPACT, DROPFRAMES, joints.json) bleiben erhalten.
# Läuft unter macOS, Linux und in der Git Bash unter Windows.
set -e
kind=$1; id=$2
case "$kind" in
  p|n|b|r|q|k) ;;
  *) echo "Aufruf: bash tools/fetch_character.sh <p|n|b|r|q|k> <character-id>"; exit 1 ;;
esac
if [ -z "$id" ]; then echo "Kennung fehlt"; exit 1; fi
dir=${CHARDIR:-art/chars}/$kind
keep=$(mktemp -d)
for f in SKIP REMAP IMPACT DROPFRAMES joints.json; do
  if [ -f "$dir/$f" ]; then cp "$dir/$f" "$keep/"; fi
done
rm -rf "$dir" && mkdir -p "$dir"
for f in SKIP REMAP IMPACT DROPFRAMES joints.json; do
  if [ -f "$keep/$f" ]; then cp "$keep/$f" "$dir/"; fi
done
rm -rf "$keep"
curl -sSfL -o "$dir/char.zip" "https://api.pixellab.ai/mcp/characters/$id/download"
(cd "$dir" && unzip -qo char.zip && rm char.zip)
echo "$id" > "$dir/ID"
echo "$kind: $(find "$dir" -name '*.png' | wc -l | tr -d ' ') PNGs"
