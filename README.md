# 漢字 Kanji japonais

Appli web perso pour apprendre à **reconnaître, lire et choisir** les kanji (JLPT N5 et N4, puis N3), en français.
Même moteur que [nihongo-grammaire](https://github.com/Sapeuri2/nihongo-grammaire) et [nihongo-vocabulaire](https://github.com/Sapeuri2/nihongo-vocabulaire), thème vert. Le code est géré par l'agent central, dépôt [nihongo-central](https://github.com/Sapeuri2/nihongo-central) (voir [MOTEUR.md](MOTEUR.md)) ; ici, on ne modifie que le contenu.

- Leçon (5 à 8 kanji : sens, lectures, mémo, mots et 3 phrases d'exemple par kanji) → 18 exercices (+ 12 rappels) → test de bloc → examens.
- Exercices : kanji ↔ sens, kanji → lecture, lecture → bon mot, mot à compléter, lecture dans une phrase, intrus, sosies, on/kun.
- La bulle des points clés ne contient **que les kanji que tu choisis** (voir « Ma bulle » plus bas). Vide par défaut.
- Furigana sur le mot entier (`{日本|にほん}`) : toucher un mot affiche toute sa lecture.
- Phrases : la traduction n'apparaît qu'après la réponse.
- À partir du bloc 3 du N4 (bloc 9), les consignes des exercices sont en japonais (expliquées au début de la leçon 41). Les fiches restent en français.
- Après une bonne réponse, la question suivante arrive seule (`autoNext: 700`).
- « Ma liste » (📌, commune aux trois applis) : chaque exercice dit quel mot garder avec ☆ (champ `star`) et ce qu'il fait apprendre (champ `card`, pour la future révision par carte).
- Furigana de moins en moins aidés : tous aux blocs 1-2, retirés sur les kanji acquis aux blocs 3-4, plus aucun sur le N5 aux blocs 5-6. Au N4, jamais de furigana sur les kanji du N5.
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

Les fichiers `data/n5/`, `data/n4/`, `data/focus/` et `data/manifest.json` sont **générés** : modifier la source, puis relancer.

1. `data/sources/kanji-n5.json`, `kanji-n4.json` : les fiches. Furigana par kanji (`{学|がく}{生|せい}`), en bloc pour les lectures spéciales (`{今日|きょう}`) ; le générateur les regroupe sur le mot entier.
   `data/sources/phrases-n4.json` : les phrases du N4.
2. `tools/generer-kanji.mjs` : les exercices, les tableaux (compteurs, jours, sosies) et les antisèches.
3. `node tools/generer-kanji.mjs`, puis `node tools/verifier.mjs`.

`node tools/ordre-kanji.mjs <vocabulaire> <grammaire>` recalcule la fréquence et réextrait les mots et phrases des deux autres applis.

## Ma bulle

`data/sources/bulle.json` liste les kanji à marteler, par exemple `["生", "後", "聞"]`. Le générateur en fait un point clé « Mes kanji à revoir » (antisèche, défi éclair, questions surprises) ; chaque question n'apparaît qu'une fois la leçon du kanji faite. Liste vide = pas de bulle.

Les identifiants sont faits de la leçon, du kanji ou mot et du type (`k5-03-食-sens`) : ils ne bougent pas si l'ordre change, mais renommer un mot publié change son identifiant.

## Règles de qualité

1. Une seule bonne réponse : une lecture fausse n'est jamais une vraie lecture du mot (liste `JAMAIS` du générateur), un kanji de remplacement ne partage aucune lecture avec celui qu'il remplace.
2. N5 : les phrases viennent telles quelles des deux autres applis. N4 : les deux autres applis n'ont pas encore de N4, les phrases sont donc écrites pour cette appli (`phrases-n4.json`), avec uniquement des kanji N5-N4 quand c'est possible.
3. Les lectures des mots présents dans le vocabulaire sont comparées automatiquement (`tools/verifier-appli.mjs`).
