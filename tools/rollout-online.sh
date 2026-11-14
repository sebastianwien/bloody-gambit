#!/bin/zsh
# Manueller Rollout des Spiels unter einen nicht erratbaren Unterordner.
# Aufruf: tools/rollout-online.sh          (baut und lädt hoch)
#         tools/rollout-online.sh --dry    (baut und zeigt nur, was hochgeladen würde)
# Ziel und Ordnername stehen in .online.env (nicht im Repo):
#   TARGET=benutzer@host:/pfad/zu/spiele   SSH_PORT=22   BASE_URL=https://beispiel.de/spiele
#   SLUG wird beim ersten Lauf zufällig erzeugt und dort gespeichert.
set -e
cd "$(dirname "$0")/.."
[[ -f .online.env ]] || { echo "Fehlt: .online.env mit TARGET, SSH_PORT, BASE_URL"; exit 1; }
source .online.env
[[ -n "$TARGET" && -n "$BASE_URL" ]] || { echo ".online.env braucht TARGET und BASE_URL"; exit 1; }
if [[ -z "$SLUG" ]]; then
  SLUG="wolfsschach-$(openssl rand -hex 8)"
  echo "SLUG=$SLUG" >> .online.env
fi
npm run -s build:online
dry=""
[[ "$1" == "--dry" ]] && dry="--dry-run"
rsync -az --delete $dry -e "ssh -p ${SSH_PORT:-22}" dist-online/ "$TARGET/$SLUG/"
echo "${dry:+(Probelauf) }$BASE_URL/$SLUG/"
