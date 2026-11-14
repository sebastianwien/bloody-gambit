#!/bin/zsh
# Lädt eine PixelLab-Figur als ZIP und entpackt sie nach art/chars/<kind>/
# Aufruf: tools/fetch_character.sh <kind p|n|b|r|q|k> <character-id>
# Handgepflegte Steuerdateien (SKIP, REMAP, IMPACT, DROPFRAMES, joints.json) bleiben erhalten.
set -e
kind=$1; id=$2
dir=${CHARDIR:-art/chars}/$kind
keep=$(mktemp -d)
for f in SKIP REMAP IMPACT DROPFRAMES joints.json; do
  [[ -f $dir/$f ]] && cp $dir/$f $keep/
done
rm -rf $dir && mkdir -p $dir
for f in $keep/*(N); do cp $f $dir/; done
rm -rf $keep
curl -sSfL -o $dir/char.zip "https://api.pixellab.ai/mcp/characters/$id/download"
(cd $dir && unzip -qo char.zip && rm char.zip)
echo $id > $dir/ID
find $dir -name '*.png' | wc -l | xargs echo "$kind: PNGs"
