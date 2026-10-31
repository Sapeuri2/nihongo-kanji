# 漢字 Kanji japonais

Appli web perso pour apprendre à **reconnaître, lire et choisir** les kanji (JLPT N5, puis N4 et N3), en français.
Même moteur que [nihongo-grammaire](https://github.com/Sapeuri2/nihongo-grammaire) et [nihongo-vocabulaire](https://github.com/Sapeuri2/nihongo-vocabulaire) (voir [MOTEUR.md](MOTEUR.md)), thème vert.

- Leçon (5 à 7 kanji : sens, lectures, mémo, mots d'exemple) → exercices → test de bloc → examens.
- Exercices : kanji ↔ sens, kanji → lecture, lecture → bon mot, mot à compléter, lecture dans une phrase, intrus, sosies, on/kun.
- Quatre points clés (bulle, antisèche, défi éclair, questions surprises) : on/kun, lectures piégeuses, compteurs et jours du mois, sosies.
- Furigana de moins en moins aidés : tous aux blocs 1-2, retirés sur les kanji acquis aux blocs 3-4, plus aucun sur le N5 aux blocs 5-6.
- Progression synchronisée via un Gist privé (`nihongo-kanji-progression.json`), hors ligne, installable.

Le plan est dans [PROGRAMME.md](PROGRAMME.md).

## Cohabitation

| | Kanji |
|---|---|
| Progression (localStorage) | `nk-state-v1` |
| Réglages de synchro | `nk-sync` |
| Fichier dans le Gist | `nihongo-kanji-progression.json` |

Ne jamais changer ces clés une fois l'appli en ligne.

## Lancer en local

```sh
python -m http.server 8000
```

## Modifier le contenu

Les fichiers `data/n5/`, `data/focus/` et `data/manifest.json` sont **générés** : modifier la source, puis relancer.

1. `data/sources/kanji-n5.json` : les fiches. Furigana par kanji (`{学|がく}{生|せい}`), en bloc pour les lectures spéciales (`{今日|きょう}`).
2. `tools/generer-kanji.mjs` : les exercices, les tableaux (compteurs, jours, sosies) et les antisèches.
3. `node tools/generer-kanji.mjs`, puis `node tools/verifier.mjs`.

`node tools/ordre-kanji.mjs <vocabulaire> <grammaire>` recalcule la fréquence et réextrait les mots et phrases des deux autres applis.

Les identifiants sont faits de la leçon, du kanji ou mot et du type (`k5-03-食-sens`) : ils ne bougent pas si l'ordre change, mais renommer un mot publié change son identifiant.

## Règles de qualité

1. Une seule bonne réponse : une lecture fausse n'est jamais une vraie lecture du mot (liste `JAMAIS` du générateur), un kanji de remplacement ne partage aucune lecture avec celui qu'il remplace.
2. Les phrases viennent telles quelles des deux autres applis : aucune n'est inventée.
3. Les lectures des mots présents dans le vocabulaire sont comparées automatiquement (`tools/verifier-appli.mjs`).
