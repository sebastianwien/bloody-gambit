#!/bin/zsh
# Lädt eine PixelLab-Figur als ZIP und entpackt sie nach art/chars/<kind>/
# Aufruf: tools/fetch_character.sh <kind p|n|b|r|q|k> <character-id>
set -e
kind=$1; id=$2
dir=art/chars/$kind
rm -rf $dir && mkdir -p $dir
curl -sSfL -o $dir/char.zip "https://api.pixellab.ai/mcp/characters/$id/download"
(cd $dir && unzip -qo char.zip && rm char.zip)
echo $id > $dir/ID
find $dir -name '*.png' | wc -l | xargs echo "$kind: PNGs"
