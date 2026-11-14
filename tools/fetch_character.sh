#!/bin/zsh
# Lädt eine PixelLab-Figur als ZIP und entpackt sie nach art/chars/<kind>/
# Aufruf: tools/fetch_character.sh <kind p|n|b|r|q|k> <character-id>
set -e
kind=$1; id=$2
dir=${CHARDIR:-art/chars}/$kind
skip=""
[[ -f $dir/SKIP ]] && skip=$(cat $dir/SKIP)
joints=""; remap=""
[[ -f $dir/joints.json ]] && joints=$(cat $dir/joints.json)
[[ -f $dir/REMAP ]] && remap=$(cat $dir/REMAP)
rm -rf $dir && mkdir -p $dir
[[ -n "$skip" ]] && echo "$skip" > $dir/SKIP
[[ -n "$joints" ]] && echo "$joints" > $dir/joints.json
[[ -n "$remap" ]] && echo "$remap" > $dir/REMAP
curl -sSfL -o $dir/char.zip "https://api.pixellab.ai/mcp/characters/$id/download"
(cd $dir && unzip -qo char.zip && rm char.zip)
echo $id > $dir/ID
find $dir -name '*.png' | wc -l | xargs echo "$kind: PNGs"
