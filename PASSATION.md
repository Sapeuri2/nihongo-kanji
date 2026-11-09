# Passation — appli Kanji (nihongo-kanji)

Rapport écrit par l'instance Claude Code de l'appli kanji, pour l'**agent central** qui reprend tout le code
(moteur commun et code des trois applis). À lire avec `README.md`, `PROGRAMME.md`, `CLAUDE.md` et `docs/DEMANDES-MOTEUR.md`.

## 1. Identité

- Dépôt : https://github.com/Sapeuri2/nihongo-kanji (branche `main`, publiée par GitHub Pages à la racine)
- Site : https://sapeuri2.github.io/nihongo-kanji/
- Dernier commit avant ce rapport : `3e5b9ce` (2026-11-09), « CLAUDE.md : tout le contexte pour reprendre dans une nouvelle session (cloud) ; demandes moteur dans docs/ ».
  Le contenu actuel vient du commit `263f985`.
- **Version du moteur : 720473c** (« suite automatique (autoNext) et Ma liste »), appliquée au commit `263f985`.
  Vérifié le 2026-11-09 : les 10 fichiers du moteur (`js/app.js`, `js/state.js`, `js/sync.js`, `js/text.js`, `js/liste.js`,
  `css/style.css`, `sw.js`, `tools/verifier.mjs`, `tools/maj-moteur.sh`, `MOTEUR.md`) sont **identiques octet pour octet**
  à ceux de nihongo-grammaire au commit `720473c`.
- **Fichiers du moteur modifiés : aucun.** Le moteur a toujours été recopié avec `bash tools/maj-moteur.sh`.
- Pas de `tools/test-parcours.mjs` ici : il a été ajouté à la grammaire (commit `587c30c`) après ma dernière mise à jour du moteur.
- **Code propre à l'appli : aucun.** Pas de `js/memo.js` ni d'autre JS. Tout ce qui est propre à l'appli kanji
  est dans `js/config.js` (valeurs seulement) et dans les **données générées** (`data/`). Les fiches, les antisèches,
  les exercices et les champs `star` / `card` sont produits par `tools/generer-kanji.mjs` (Node, hors navigateur).

## 2. L'utilisateur et sa méthode (pour cette appli)

- Francophone, apprend seul. N5 fini ; dans l'appli kanji, il a fini la **leçon 32** début novembre 2026
  (= `k4-02`, 2e leçon du N4). Sa progression réelle est dans son navigateur et son Gist, pas dans le dépôt.
- Méthode : **répéter jusqu'à ce que ça reste**. Sa crainte, en ses mots : « sur le moment je valide tout, mais après ça
  ne revient plus vraiment, et si ça ne revient pas je vais oublier ». Il veut que tout revienne **sur 4-5 jours**
  sans rallonger les leçons → demandes B1 (révisions par carte) et B2 (stats) dans `docs/DEMANDES-MOTEUR.md`.
- Écrit vite avec des fautes de frappe : comprendre l'intention, ne pas le corriger. Réponses en français, simples, directes.
- Ce qu'il a demandé pour les kanji :
  - leçons plus longues : **30 questions** (18 nouvelles + 12 rappels) ;
  - furigana sur le **mot entier** (toucher un mot montre toute sa lecture) ;
  - traduction des phrases **cachée** jusqu'à la réponse ;
  - **3 phrases d'exemple** par kanji dans les fiches ;
  - consignes des exercices **en japonais** à partir du bloc 9 (leçon 41) ; leçons entièrement en japonais prévues pour le N3 ;
  - la **bulle** (points clés) ne contient **que les kanji qu'il choisit** (rien d'automatique, vide pour l'instant) ;
  - la question suivante arrive seule après une bonne réponse (`autoNext: 700`) ;
  - plus difficile au N4 : saisie au clavier japonais, tracer le kanji, examen de fin de niveau complet (demandés au moteur, pas encore faits).
- Il fait passer lui-même les messages entre les instances (copier-coller). Il veut que chaque changement terminé soit poussé sur `main`.

## 3. Ce que fait l'appli

- Parcours du moteur commun : leçon (fiche + exercices, 70 % pour valider) → test de bloc toutes les 5 leçons (30 q., 80 %)
  → examen intermédiaire tous les 2 blocs (40 q.) → grand examen tous les 4 blocs (60 q.). Numérotation globale N5 + N4.
- Contenu : **309 kanji** (N5 : 107, N4 : 202), **70 leçons** en **14 blocs**, **1 693 exercices**, **769 cartes**.
  - N5 : blocs 1-4 (kanji), bloc 5 = pièges (on/kun, lectures piégeuses, sosies, compteurs, jours du mois), bloc 6 = lire sans aide.
  - N4 : blocs 7-13 (kanji, dont bloc 13 « Le quotidien »), bloc 14 = lire sans aide. Détail dans `PROGRAMME.md`.
- Fiche d'une leçon (5 à 8 kanji) : sens, on/kun, mémo, mots (`vocab`, avec ☆), 3 phrases d'exemple (`ex`).
  Antisèches générées : compteurs, jours, sosies, on/kun.
- **Un seul type d'exercice moteur : `choice` (QCM).** Familles (suffixe de l'id) :
  `sens` (kanji → sens, 309), `kanji` (sens → kanji, 94), `lecture` (comment se lit ce mot, 479),
  `ecrit` (lecture → bon mot écrit, 153), `trou` (compléter le mot, 55), `phrase` (lecture du mot en gras dans une phrase, 445),
  `intrus` (le seul mot mal lu, 55), `piege` (18), plus on/kun, sosies, compteurs, jours (bloc 5).
- Furigana de moins en moins présents : tous aux blocs 1-2, retirés sur les kanji acquis aux blocs 3-4, aucun sur le N5
  aux blocs 5-6 ; au N4, jamais de furigana sur les kanji N5, et plus aucun au bloc 14.
- Consignes en japonais dès `k4-b03` (bloc 9), expliquées au début de la leçon 41 (`enJaponais` dans le générateur).
- Chaque exercice porte `star` (le mot que ☆ doit garder dans « Ma liste ») et `card` (ce qu'on apprend). **Le moteur 720473c
  ne les lit pas encore** (demandes A2 et B1).
- Réglages de `js/config.js` : `storageKey 'nk-state-v1'`, `syncKey 'nk-sync'`, `gistFile 'nihongo-kanji-progression.json'`,
  `gistDescription 'Progression nihongo-kanji (ne pas supprimer)'`, `tokenName 'nihongo-kanji'`, `appId 'kanji'`,
  `autoNext 700`, `listeEnabled true`, `lessonPass 0.7`, `testPass 0.8`, `lessonRecall 12`, `testSize 30`,
  `miniExamSize 40`, `examSize 60`, `recallShare 0.25`, `reviewSize 20`, `drillSize 15`, `maxRetries 2`,
  `focusEvery 4`, `focusInTests 3`, `focusChallengeSize 10`, `hideBlankTranslation true`.
- Réglages prévus quand le moteur les aura (voir § 8) : `intervals: [0, 1, 2, 4, 7, 15, 30, 60]`, `slowMs: 8000`,
  `dailyReviewMax: 30`, `recallScope: 'level'`, `reviewGate` à **demander à l'utilisateur** (prévenir ou verrouiller).

## 4. Architecture

Site statique, même moteur que la grammaire, aucun code JS propre.

| Fichier | Rôle | Propriétaire |
| --- | --- | --- |
| `js/app.js`, `js/state.js`, `js/sync.js`, `js/text.js`, `js/liste.js`, `css/style.css`, `sw.js`, `tools/verifier.mjs`, `tools/maj-moteur.sh`, `MOTEUR.md` | Moteur commun, copie exacte de grammaire `720473c` | moteur |
| `js/config.js` | Clés de stockage + réglages pédagogiques (valeurs seulement) | appli |
| `css/theme.css` | Couleur verte : `--accent #2e7d5b` (sombre : `#5cc08f`) | appli |
| `index.html` | Identique à celui de la grammaire sauf titre « Kanji japonais », `theme-color #2e7d5b`, logo « 漢字 Kanji » | appli |
| `manifest.webmanifest`, `icons/icon-192.png`, `icons/icon-512.png`, `.nojekyll` | Installation (PWA), icônes ; `.nojekyll` pour GitHub Pages | appli |
| `data/manifest.json`, `data/n5/bloc01-06.json`, `data/n4/bloc01-08.json` | Contenu servi au moteur. **Générés**, ne pas éditer à la main | appli (contenu) |
| `data/sources/kanji-n5.json`, `kanji-n4.json` | Fiches : leçons, kanji, sens, on/kun, mémo, mots | appli (contenu) |
| `data/sources/phrases.json` | Phrases N5 reprises des deux autres applis | appli (contenu) |
| `data/sources/phrases-n4.json` | ~590 phrases N4 écrites par Claude | appli (contenu) |
| `data/sources/mots-vocab.json` | Mots et lectures de l'appli vocabulaire (référence des lectures) | appli (contenu) |
| `data/sources/ordre-n5.json` | Ordre de fréquence des kanji N5 (calculé par `ordre-kanji.mjs`) | appli (contenu) |
| `data/sources/bulle.json` | Kanji de la bulle choisis par l'utilisateur (`[]` aujourd'hui) | appli (contenu) |
| `tools/generer-kanji.mjs` | Générateur : sources → `data/` (fiches, antisèches, exercices, tests, examens, `star`, `card`, bulle) | appli (contenu) |
| `tools/ordre-kanji.mjs` | Recalcule l'ordre et réextrait mots/phrases des deux autres applis | appli (contenu) |
| `tools/verifier-appli.mjs` | Contrôles propres aux kanji, lancé par `tools/verifier.mjs` | appli (contenu) |
| `README.md`, `PROGRAMME.md`, `CLAUDE.md`, `docs/DEMANDES-MOTEUR.md`, `PASSATION.md` | Docs | appli |

**Écarts avec le moteur commun** : aucun dans le code. Différences d'usage seulement :
- `autoNext: 700` (la grammaire est à 0) et `lessonRecall: 12` (grammaire : 5) ;
- `data/manifest.json` a `focus: []` : pas de point clé tant que `bulle.json` est vide ;
- les blocs N4 ont des ids `k4-b01` … `k4-b08` dans le dossier `data/n4/`, mais ils sont les blocs **7 à 14** du parcours (numérotation globale) ;
- champs `star` et `card` sur chaque exercice (ignorés par le moteur actuel).

## 5. Données à ne jamais casser

- localStorage (origine `sapeuri2.github.io`, partagée par les 3 applis) :
  `nk-state-v1` (progression), `nk-state-v1:seance` (série en cours, clé dérivée par le moteur), `nk-sync` (clé GitHub + id du Gist),
  `nihongo-ma-liste-v1` et `nihongo-ma-liste-gist` (**communes aux 3 applis** ; ne jamais vider la liste).
- Gists : `nihongo-kanji-progression.json` (progression) et `nihongo-ma-liste.json` (commun).
- Identifiants (la progression y est rattachée) :
  - blocs : `k5-b01` … `k5-b06`, `k4-b01` … `k4-b08` ;
  - leçons : `k5-01` … `k5-30`, `k4-01` … `k4-40` (leçon globale 31 = `k4-01`) ;
  - exercices de leçon : `<leçon>-<kanji ou mot>-<famille>`, ex. `k5-03-食-sens`, `k4-11-教える-lecture` ;
  - exercices de test : `<bloc>-<mot>-<famille>` (ex. `k4-b01-…`) ; d'examen : `<bloc>x-…` (ex. `k4-b02x-…`) ;
  - bloc 5 (pièges) : préfixes `k5-21` … `k5-25` et `k5-b05-…` (tableaux compteurs, jours, sosies).
  Les ids viennent du **contenu**, pas de la position : changer l'ordre ne casse rien, mais **renommer un mot publié change son id**.
- Format furigana `{日本|にほん}` (mot entier) dans les données servies.

## 6. Règles de qualité du contenu

- **Une seule bonne réponse** : une lecture fausse n'est jamais une vraie lecture du mot (ensemble `JAMAIS` et lectures connues
  `KANAS` dans le générateur) ; un kanji de remplacement ne partage aucune lecture avec celui qu'il remplace ; kanji ambigus
  (`AMBIGUS` : 何 後 間 方…) exclus des questions de lecture isolée ; voisins de sens (`VOISINS` : 天/空, 時/間/分…) jamais face à face.
- **Lectures identiques à l'appli vocabulaire** (`mots-vocab.json`, contrôlé par `verifier-appli.mjs`).
- Fiches : 5 à 8 kanji par leçon, sens + mémo obligatoires, 1 à 5 mots contenant le kanji, 3 phrases d'exemple.
- N5 : phrases reprises telles quelles des deux autres applis. N4 : phrases et fiches **écrites par Claude** (les autres applis
  n'ont pas de N4), avec des kanji N5-N4 seulement quand c'est possible ; l'utilisateur peut signaler des erreurs.
- Furigana : les sources écrivent kanji par kanji (`{日|に}{本|ほん}`) ; le générateur fusionne sur le mot entier **uniquement
  pour les mots** connus, jamais toute une phrase (sinon deux mots voisins se collent).
- Une question n'utilise que des kanji déjà vus (champ `uses`), et les furigana suivent la règle « de moins en moins aidés » (§ 3).
- La bulle ne contient que les kanji donnés par l'utilisateur.

## 7. Outils et façon de travailler

1. Modifier `data/sources/*.json` ou `tools/generer-kanji.mjs` (jamais `data/n5`, `data/n4`, `data/manifest.json` à la main).
2. `node tools/generer-kanji.mjs`, puis `node tools/verifier.mjs` → doit finir par
   « OK (kanji) : 309 kanji. » et « OK : 70 leçons, 1693 exercices. » (état au 2026-11-09).
3. Test manuel : `python -m http.server 8765`, http://localhost:8765, après avoir désinscrit le service worker et vidé les caches.
   Je vérifiais au format téléphone (390 px) : fiche, ☆, `#/liste`, export Anki. Pas de test automatique de bout en bout dans ce dépôt.
4. `node tools/ordre-kanji.mjs <dossier vocabulaire> <dossier grammaire>` quand les autres applis changent leurs phrases.
5. Moteur : `bash tools/maj-moteur.sh` (à relancer une fois s'il plante, voir A1).
6. Commits en français, push direct sur `main`. Résumé à l'utilisateur : ce qui a changé, ce qui n'est pas vérifié, ce qui attend le moteur.
7. Demandes au moteur : écrites dans `docs/DEMANDES-MOTEUR.md`, transmises par l'utilisateur.

## 8. Limites, bugs connus, demandes en attente

Toutes détaillées dans `docs/DEMANDES-MOTEUR.md` (envoyées à la grammaire, **sans réponse** au 2026-11-09) :
- **A1** `tools/maj-moteur.sh` s'écrase lui-même au premier lancement (`syntax error near unexpected token '('`, `js/liste.js` pas copié) ; un 2e lancement marche.
- **A2** ☆ après une question garde souvent un mauvais mot (lecture seule, morceau de mot, phrase entière, consigne japonaise) :
  utiliser le champ `star` quand il existe (`star: null` = pas de ☆). C'est le bug le plus visible aujourd'hui.
- **A3** Sur `#/liste`, avec furigana, la lecture apparaît deux fois.
- **B1** Révisions par carte (`card`), `intervals`, carte fragile après erreur, `slowMs`, « Révisions du jour » séparées des leçons, `dailyReviewMax`, `reviewGate`.
- **B2** Journal de chaque réponse + page `#/stats` (confusions, cartes fragiles/lentes, taux d'oubli, export).
- **B3** `recallScope: 'level'` (rappels du niveau en cours, sauf 1er bloc d'un niveau ; aussi pour `recallShare`).
- **B4** Exercice `input` (saisie japonaise, `answers`, `script`, gestion de la composition IME).
- **B5** Grille de 20 choix. **B6** Exercice `draw` (tracer, auto-évaluation). **B7** `fullExam` (examen de fin de niveau complet).

Ce que je prévoyais côté contenu une fois le moteur prêt : saisie au N4 (lecture d'un mot, trou dans une phrase, katakana,
français → hiragana) ; examen de fin de N5 et de N4 (chaque kanji en français → le trouver parmi 20, plus une sélection à tracer).

Autres limites :
- Avec `autoNext: 700`, la ☆ d'une bonne réponse n'est visible que 0,7 s.
- Kanji N4 avec seulement 2-3 phrases d'exemple : 説 短 堂 民 起 使 台 春 昼 夕 顔 首 死 同 考 悪 注 品 調 返 払.
- Phrases et fiches N4 écrites par Claude : pas relues par un natif.
- « Ma liste » : destination finale des flashcards pas choisie (export Anki CSV / JSON existe).
- Les idées de la grammaire (étoiles sur les leçons, scroll, « Leçon suivante ») concernent aussi cette appli, puisque le moteur est le même.
- Je ne sais pas si l'appli vocabulaire a appliqué le moteur `720473c`.
- Je ne sais pas comment la synchro Gist se comporte avec le vrai Gist de l'utilisateur depuis 720473c (testé seulement en local).

## 9. Après la passation

L'instance kanji ne gère plus que le **contenu** : `data/sources/*.json`, `tools/generer-kanji.mjs`, `tools/ordre-kanji.mjs`,
`tools/verifier-appli.mjs`, les fichiers générés de `data/`, `PROGRAMME.md` et les docs du contenu.
Tout changement de code (moteur, `js/`, `css/`, `sw.js`, `index.html`, outils du moteur) passe par l'agent central.
Quand il ajoute un réglage ou un type d'exercice, il m'envoie le format attendu et les réglages à mettre ; je génère alors
le contenu qui l'utilise (saisie, grille de 20, tracé, examen complet) et je fais un retour.
