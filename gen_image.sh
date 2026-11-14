#!/bin/zsh
# Usage: gen_image.sh <out.png> <prompt-file> [reference-image]
# Erzeugt ein Bild per OpenAI Images API. Mit Referenzbild über /edits (Stil übernehmen).
set -e
out=$1; prompt=$(cat "$2"); ref=$3
key=$(cat ~/.config/openai/key)
if [[ -n "$ref" ]]; then
  resp=$(curl -sS https://api.openai.com/v1/images/edits \
    -H "Authorization: Bearer $key" \
    -F model=${MODEL:-gpt-image-2} -F size=1536x1024 -F quality=medium \
    -F "image[]=@$ref;type=image/${ref:e:s/jpg/jpeg/}" -F "prompt=$prompt")
else
  resp=$(curl -sS https://api.openai.com/v1/images/generations \
    -H "Authorization: Bearer $key" -H "Content-Type: application/json" \
    -d "$(python3 -c 'import json,sys;print(json.dumps({"model":"${MODEL:-gpt-image-2}","size":"1536x1024","quality":"medium","prompt":sys.argv[1]}))' "$prompt" "${MODEL:-gpt-image-2}")")
fi
echo "$resp" | python3 -c '
import json,sys,base64
r=json.load(sys.stdin)
if "error" in r: sys.exit("API-Fehler: "+r["error"].get("message",""))
open(sys.argv[1],"wb").write(base64.b64decode(r["data"][0]["b64_json"]))
print("ok", sys.argv[1])' "$out"
