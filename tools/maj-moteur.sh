#!/usr/bin/env bash
# Met à jour le moteur commun (voir MOTEUR.md) depuis le dépôt de la grammaire.
# Usage, depuis la racine du dépôt de l'appli : bash tools/maj-moteur.sh
set -euo pipefail

SOURCE="${MOTEUR_SOURCE:-https://github.com/Sapeuri2/nihongo-grammaire}"
FILES=(js/app.js js/state.js js/sync.js js/text.js css/style.css sw.js tools/verifier.mjs tools/maj-moteur.sh MOTEUR.md)

if [ ! -f data/manifest.json ]; then
  echo "À lancer depuis la racine du dépôt de l'appli (data/manifest.json introuvable)." >&2
  exit 1
fi

if git remote get-url origin 2>/dev/null | grep -q 'nihongo-grammaire'; then
  echo "C'est le dépôt du moteur lui-même : rien à faire."
  exit 0
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git clone --depth 1 -q "$SOURCE" "$tmp/moteur"

for f in "${FILES[@]}"; do
  mkdir -p "$(dirname "$f")"
  cp "$tmp/moteur/$f" "$f"
done
echo "Moteur mis à jour depuis $SOURCE"
echo "Version : $(git -C "$tmp/moteur" log -1 --format='%h — %s (%cs)')"

# Réglages présents dans le moteur de référence mais absents d'ici.
keys() { grep -oE '^[[:space:]]+[A-Za-z]+:' "$1" | tr -d ' :' | sort -u; }
if [ ! -f js/config.js ]; then
  echo
  echo "⚠ js/config.js n'existe pas : crée-le à partir de celui du moteur (et change les clés de stockage !)."
else
  missing=$(comm -23 <(keys "$tmp/moteur/js/config.js") <(keys js/config.js))
  if [ -n "$missing" ]; then
    echo
    echo "⚠ Réglages à ajouter dans js/config.js (valeurs de la grammaire, à adapter) :"
    for k in $missing; do grep -E "^[[:space:]]+$k:" "$tmp/moteur/js/config.js"; done
  fi
fi
[ -f css/theme.css ] || echo "⚠ css/theme.css n'existe pas : crée-le (voir celui du moteur)."
grep -q 'css/theme.css' index.html || echo "⚠ index.html doit charger css/theme.css après css/style.css."

echo
echo "Fichiers modifiés :"
git status --short "${FILES[@]}" || true
echo
echo "Ensuite : lis l'historique en bas de MOTEUR.md, lance node tools/verifier.mjs, teste, puis commit."
