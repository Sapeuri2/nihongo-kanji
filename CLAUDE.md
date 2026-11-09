# CLAUDE.md — appli kanji (contexte pour reprendre le travail)

Ce fichier est lu au début de chaque session. Il remplace la mémoire de la conversation précédente
(menée sur le PC de l'utilisateur jusqu'au 2026-11-09). Réponds toujours **en français**, ton simple et direct.

## Quand l'utilisateur écrit juste « Re » (ou « salut », « on reprend »…)

Fais comme si la conversation continuait : salue-le brièvement, puis en 4-5 lignes rappelle où on en est
(section « Où on en est » plus bas) et ce qu'on attend. Demande-lui s'il a la réponse de la session grammaire
(mise à jour du moteur) ou ce qu'il veut faire. Ne relis pas tout le dépôt avant de répondre ; ce fichier suffit pour saluer.

## L'utilisateur

- Apprend le japonais seul, en français. Il a fini le N5 et vient d'attaquer le N4 (leçon 32 terminée début novembre 2026).
- Sa méthode : répéter jusqu'à ce que ça reste. Sa crainte : « je valide tout sur le moment, mais si ça ne revient pas, j'oublie ».
- Écrit vite, avec des fautes de frappe : comprendre l'intention, ne pas le corriger.
- Utilise trois applis web à lui, sur `sapeuri2.github.io` : **grammaire** (dépôt de référence du moteur),
  **vocabulaire**, et celle-ci, **kanji** (https://sapeuri2.github.io/nihongo-kanji/).
- Une instance Claude s'occupe de chaque appli. Il fait passer lui-même les messages entre elles (copier-coller).

## RÈGLE D'OR

Ne modifie **JAMAIS** les fichiers du moteur : `js/app.js`, `js/state.js`, `js/sync.js`, `js/text.js`, `js/liste.js`,
`css/style.css`, `sw.js`, `tools/verifier.mjs`, `tools/maj-moteur.sh`, `MOTEUR.md`.
Ils viennent de Sapeuri2/nihongo-grammaire et sont recopiés par `bash tools/maj-moteur.sh`.
Si le moteur doit évoluer : ne le fais pas. Écris précisément le changement dans `docs/DEMANDES-MOTEUR.md`
et donne le texte à l'utilisateur pour qu'il le transmette à l'instance grammaire.

Fichiers autorisés : `js/config.js`, `css/theme.css`, `index.html`, `manifest.webmanifest`, `icons/`, `data/`,
`README.md`, `PROGRAMME.md`, `CLAUDE.md`, `docs/`, `tools/verifier-appli.mjs`, `tools/generer-kanji.mjs`, `tools/ordre-kanji.mjs`.

**Ne jamais changer** `storageKey` (`nk-state-v1`), `gistFile`, ni la clé commune de « Ma liste » (`nihongo-ma-liste-v1`,
partagée avec les deux autres applis), et ne jamais vider la liste.

## Comment on travaille

1. Modifier les sources (`data/sources/*.json`) ou le générateur (`tools/generer-kanji.mjs`). Ne jamais éditer `data/n5`, `data/n4`, `data/manifest.json` à la main : ils sont générés.
2. `node tools/generer-kanji.mjs` puis `node tools/verifier.mjs` (doit finir par « OK »).
3. Tester : `python -m http.server 8765` à la racine du dépôt, puis ouvrir http://localhost:8765 (penser à désinscrire le service worker et vider les caches pour voir la nouvelle version).
4. Commit sur `main` et push : GitHub Pages met le site en ligne. L'utilisateur attend que chaque changement terminé soit poussé.
5. Résumer en français ce qui a changé, ce qui n'a pas été vérifié, et ce qui attend la grammaire.

Règles du contenu :
- Les **ids d'exercices** viennent du contenu (`k5-03-食-sens`) : ils portent la progression. Ne pas casser les ids du N5 ni des leçons déjà faites.
- **Furigana sur le mot entier** (`{日本|にほん}`) : toucher un mot montre toute sa lecture. Les sources des fiches écrivent les mots kanji par kanji (`{日|に}{本|ほん}`) ; le générateur fusionne à l'écriture **uniquement les mots** (pas les phrases, sinon deux mots voisins se collent).
- Traduction des phrases cachée jusqu'à la réponse. Phrases d'exemple (3 par kanji) dans les fiches.
- Leçon = 18 exercices nouveaux (`LECON_MAX`) + 12 rappels (`lessonRecall`) ≈ 30 questions.
- À partir du bloc 3 du N4 (bloc 9, leçon 41), consignes des exercices **en japonais** (`enJaponais` dans le générateur). Fiches en français. Leçons entièrement en japonais : prévu pour le N3.
- La **bulle** (points clés) ne contient **que les kanji que l'utilisateur donne** : `data/sources/bulle.json` (vide pour l'instant). Rien d'automatique.
- N5 : phrases reprises telles quelles des deux autres applis (`phrases.json`). N4 : les autres applis n'ont pas de N4 ; les phrases (`phrases-n4.json`, ~590) et les fiches N4 ont été **écrites par Claude** : l'utilisateur peut signaler des erreurs.
- Lectures des mots identiques à l'appli vocabulaire (`mots-vocab.json`, vérifié par `verifier-appli.mjs`).
- Chaque exercice porte `star` (le mot que ☆ doit garder dans « Ma liste ») et `card` (le kanji ou le mot appris, pour la future révision par carte). Le moteur ne les utilise pas encore (demandé).
- Réglages actuels de `js/config.js` : `appId: 'kanji'`, `autoNext: 700` (la question suivante arrive seule après une bonne réponse), `listeEnabled: true`, `lessonRecall: 12`.

Les deux autres dépôts (pour `tools/ordre-kanji.mjs` ou pour reprendre leurs phrases) : `git clone https://github.com/Sapeuri2/nihongo-grammaire` et `…/nihongo-vocabulaire` dans un dossier à part.

## Contenu actuel

- **N5** : 107 kanji, 30 leçons, blocs 1 à 6 (bloc 5 = pièges, bloc 6 = lire sans aide).
- **N4** : 202 kanji, 40 leçons, blocs 7 à 14. Couvre toute la liste N4 de tanos.co.uk (182) + 公, 無 et des kanji N4 fréquents (bloc 13 « Le quotidien » : 回 番 号 階 歳 決 次 調 返 払 遊 泳 酒 晩 降 公 結 婚 留 皆 部 窓 冷 無 由). Bloc 14 = lire sans aide.
- Détail : `PROGRAMME.md`. Examens : intermédiaire tous les 2 blocs, grand examen tous les 4 (numérotation globale).

## Où on en est (2026-11-09)

Dernier commit : « Moteur 720473c (suite auto, Ma liste) ; exemples dans les fiches, consignes en japonais dès le bloc 9, leçons à 30, 227 phrases N4 ».

**On attend la session grammaire.** L'utilisateur lui a transmis `docs/DEMANDES-MOTEUR.md` :
- A1 : `maj-moteur.sh` s'écrase lui-même au premier lancement (il faut le relancer une fois).
- A2 : utiliser le champ `star` pour ☆ (aujourd'hui ☆ après une question garde souvent une lecture seule, un morceau de mot, ou la consigne japonaise).
- A3 : lecture affichée deux fois sur la page `#/liste`.
- B1 : révisions **par carte** (champ `card`), intervalles réglables, « Révisions du jour » séparées des leçons, `slowMs`, `dailyReviewMax`, `reviewGate`.
- B2 : journal de chaque réponse + page `#/stats` (confusions, cartes fragiles ou lentes, taux d'oubli).
- B3 : `recallScope: 'level'` (rappels du niveau en cours seulement, sauf premier bloc d'un niveau).
- B4 : exercice `input` (saisie au clavier japonais, hiragana/katakana). B5 : grille de 20 choix. B6 : `draw` (tracer le kanji, auto-évaluation). B7 : `fullExam` (examen de fin de niveau complet).

**Quand la grammaire a répondu** (l'utilisateur colle son message) :
1. `bash tools/maj-moteur.sh` (le relancer s'il plante une fois), ajouter les nouveaux réglages dans `js/config.js` :
   `intervals: [0, 1, 2, 4, 7, 15, 30, 60]`, `slowMs: 8000`, `dailyReviewMax: 30`, `recallScope: 'level'`,
   `reviewGate` : **à demander à l'utilisateur** (prévenir ou verrouiller quand trop de révisions sont en retard).
2. Lire l'historique de `MOTEUR.md`, vérifier, tester dans le navigateur, vérifier ☆ sur chaque type d'exercice.
3. Générer les nouveaux exercices dès que le moteur les accepte : saisie (N4 : lecture d'un mot, trou dans une phrase, katakana, français → hiragana) ; examen de fin de N5 et de N4 : chaque kanji en français → le trouver parmi 20, plus une sélection à tracer.
4. Faire un retour à la grammaire (ce qui marche, ce qui gêne), commit, push.

**Autres choses en suspens**
- Kanji de la bulle : attendre que l'utilisateur les donne (« mets 生 後 聞 dans la bulle »), les ajouter à `bulle.json`, régénérer.
- Quelques kanji N4 n'ont encore que 2-3 phrases (説 短 堂 民 起 使 台 春 昼 夕 顔 首 死 同 考 悪 注 品 調 返 払) : en écrire si l'occasion se présente.
- « Ma liste » : destination finale des flashcards pas encore choisie (export Anki CSV / JSON déjà disponible).
- Plus tard : N3, avec des leçons entièrement en japonais.

Historique détaillé des choix et des demandes : `docs/DEMANDES-MOTEUR.md`, `README.md`, `PROGRAMME.md`, et `git log`.
