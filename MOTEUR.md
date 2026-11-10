# Le moteur (code commun des applis)

Les trois applis (grammaire, vocabulaire, kanji) utilisent le même moteur.
**Depuis le 2026-11-10, tout le code est géré par l'agent central** (dépôt
[Sapeuri2/nihongo-central](https://github.com/Sapeuri2/nihongo-central)) : la grammaire n'est plus
le dépôt de référence du moteur. Chaque appli garde sa propre copie, qui fonctionne seule.

## Qui modifie quoi

| Fichiers | Qui |
| --- | --- |
| `js/` (dont `js/config.js`), `css/`, `sw.js`, `index.html`, `manifest.webmanifest`, `icons/`, `tools/verifier.mjs`, `tools/test-parcours.mjs`, `tools/test-parcours-init.js`, `MOTEUR.md` | **l'agent central uniquement** |
| `data/`, `PROGRAMME.md`, partie « contenu » du `README.md`, outils de contenu (générateurs, `tools/verifier-appli.mjs`…) | l'instance Claude de l'appli |

Une instance qui a besoin d'une évolution du code (nouveau type d'exercice, réglage, correctif) ne la fait pas :
elle la décrit précisément à l'utilisateur, qui la transmet à l'agent central. Après chaque changement,
l'agent central envoie à chaque instance concernée un message : ce qui a changé, ce qu'il faut faire
(`git pull`, nouveaux champs du contenu, réglages), comment s'en servir, ce qu'il ne faut pas toucher.

**Ne jamais changer** les clés de stockage (`storageKey`, `syncKey`), le nom du fichier Gist, ni les identifiants
des leçons et des exercices déjà publiés : la progression y est rattachée.

## Fichiers du moteur (identiques dans les trois applis)

| Fichier | Rôle |
| --- | --- |
| `js/app.js` | Navigation, leçons, exercices, tests, examens, révisions |
| `js/state.js` | Progression, répétition espacée, fusion entre appareils |
| `js/sync.js` | Synchronisation via un Gist GitHub privé |
| `js/text.js` | Furigana `{漢字|かんじ}`, gras, trous |
| `js/liste.js` | « Ma liste » : stockage, fusion, export |
| `css/style.css` | Apparence commune |
| `sw.js` | Hors ligne (cache nommé d'après l'adresse de l'appli) |
| `tools/verifier.mjs` | Vérification du contenu |
| `tools/test-parcours.mjs` | Test de bout en bout dans Chromium (tout le parcours, format téléphone) |
| `MOTEUR.md` | Ce fichier |

## Fichiers propres à chaque appli

| Fichier | Contenu |
| --- | --- |
| `js/config.js` | Clés de stockage, nom du fichier Gist, réglages pédagogiques |
| `css/theme.css` | Couleur principale (rouge pour la grammaire, bleu pour le vocabulaire, vert pour les kanji) |
| `index.html`, `manifest.webmanifest`, `icons/` | Nom, icône, couleur de la barre du téléphone |
| Code propre à une appli | Ex. la bulle い/な/て du vocabulaire (`js/memo.js`, `css/memo.css`) |
| `tools/test-parcours-init.js` | Facultatif : script lancé dans la page avant l'appli pendant le test (ex. vocabulaire : couper les rappels surprise) |
| `data/` | Le contenu (leçons, exercices) |
| `tools/verifier-appli.mjs` | Facultatif : contrôles propres à l'appli, lancés par `tools/verifier.mjs` (code de sortie ≠ 0 = échec) |
| `README.md`, `PROGRAMME.md` | Documentation de l'appli |

## Vérifier avant chaque push

Depuis la racine du dépôt de l'appli :

```sh
node tools/verifier.mjs                  # le contenu (lance aussi tools/verifier-appli.mjs)
node tools/test-parcours.mjs             # tout le parcours dans Chromium, format téléphone
ETAPES=10 node tools/test-parcours.mjs   # version courte : les 10 premières étapes
```

Le test part d'un navigateur neuf : il ne touche jamais à la vraie progression. Il signale les erreurs JS et
les débordements horizontaux (accueil, Ma liste, réglages, chaque leçon, 1re question de chaque série).
Durée du parcours complet : environ 2 min 30 pour la grammaire et le vocabulaire, environ 13 minutes pour les kanji.

## Format : mots d'une leçon (facultatif)

Une leçon peut avoir un champ `words`, affiché en tableau Mot / Lecture / Sens avant les sections.
La colonne Lecture suit le réglage des furigana (masquée → on touche la case pour la voir).

```json
"words": [
  { "jp": "{傘|かさ}", "kana": "かさ", "fr": "parapluie", "ex": "{傘|かさ}を{買|か}いました。", "exFr": "J'ai acheté un parapluie." }
]
```

`jp`, `kana` et `fr` sont obligatoires ; `ex` (phrase d'exemple) et `exFr` (sa traduction) sont facultatifs.

## Format : points clés (facultatif)

Un point clé est une notion à marteler. Dans `data/manifest.json` : `"focus": ["data/focus/xxx.json"]`.
Une fois la leçon `unlockAfter` validée :
- une **bulle** (avec `label`) est affichée partout sauf pendant les tests et examens ; elle ouvre l'**antisèche** ;
- une carte sur l'accueil propose l'antisèche, un **défi éclair** et la maîtrise du point ;
- une question du point clé est glissée toutes les `focusEvery` questions (leçons, révisions, entraînements)
  et `focusInTests` questions sont ajoutées à chaque test et examen (elles comptent).

```json
{
  "id": "adj-i-na", "label": "い・な", "title": "Adjectifs : い ou な ?", "unlockAfter": "n5-09",
  "sheet": { "sections": [ { "h": "…", "p": ["…"], "grid": { "head": ["", "…"], "rows": [["…", "…"]] } } ], "pieges": ["…"] },
  "exercises": [ { "id": "…", "type": "choice", "uses": ["n5-08"], "…": "…" } ]
}
```

Les sections de l'antisèche ont le même format que celles d'une leçon, plus `grid` (tableau).
Une question n'apparaît que si les leçons de son `uses` sont faites. Dans tous les textes, `==texte==` surligne.
Les exercices d'un point clé peuvent être écrits à la main ou générés par un script propre à l'appli
(ex. `tools/generer-adjectifs.mjs` dans la grammaire).

## Format : Ma liste (commune aux applis)

Les mots mis de côté (☆) forment **une seule liste pour toutes les applis** du domaine `sapeuri2.github.io`.
- Stockage : clé fixe `nihongo-ma-liste-v1` (indépendante de `storageKey`), gérée par `js/liste.js`.
- Synchro : un Gist commun, fichier `nihongo-ma-liste.json` (trouvé par son nom, créé s'il manque), avec la clé GitHub de l'appli ouverte. Le Gist trouvé est retenu dans `nihongo-ma-liste-gist`.
- Un mot : `{ id, jp, kana, fr, app: [..], src, at, stats: { vu, juste, faux, serie, boite, prochain, dernier }, log }`.
  `id` = `jp` sans furigana. `log` = `[[horodatage, 1|0], …]` : les stats en sont déduites, ce qui permet de fusionner sans compter deux fois une réponse.
  `boite` 0 à 5 ; `prochain` = boîte → 0, 1, 3, 7, 14, 30 jours.
- Fusion : réunion des mots, ajout le plus ancien, applis d'origine et réponses réunies ; `supprimes: { id: date }` empêche un mot retiré de revenir (sauf s'il est rajouté après).
- Aucun retrait automatique : seul « Retirer de ma liste » (page `#/liste`, avec confirmation) enlève un mot.
- Réglages `js/config.js` : `listeEnabled` (`true`) et `appId` (`grammaire`, `vocabulaire`, `kanji` : sert d'étiquette et de tag Anki ; à défaut, déduit de l'adresse).
- ☆ : lignes des tableaux `words` et `vocab`, et bloc de réponse après chaque question (phrase japonaise sans trou, sinon bonne réponse, sinon le japonais de la consigne).
- Page `#/liste` + bouton 📌 + carte d'accueil : tri, « Réviser ma liste » (20 questions générées : mot → sens, sens → mot, kanji → lecture ; mauvaises réponses prises dans la liste, complétées par le vocabulaire de l'appli si elle est courte), export Anki (CSV `recto;verso;tags`), JSON, copie.
- Ces révisions comptent dans le 🔥 mais pas dans la progression de l'appli.

## Historique des changements du moteur

### 2026-11-10 — Le moteur n'est plus pris dans la grammaire
- Le code des trois applis est géré par l'agent central (dépôt `nihongo-central`). **`tools/maj-moteur.sh` est supprimé** :
  ne plus aller chercher le moteur dans le dépôt de la grammaire.
- **Aucun changement** dans `js/`, `css/`, `sw.js`, `index.html` ni `data/` : les applis fonctionnent exactement comme avant.
- `tools/test-parcours.mjs` est maintenant dans les trois applis. Il marche avec la suite automatique (`autoNext`),
  vérifie aussi l'accueil, Ma liste, les réglages et la 1re question de chaque série, accepte `ETAPES=n`
  et un fichier facultatif `tools/test-parcours-init.js`.

### 2026-11-04 — Suite automatique et « Ma liste »
- **Nouveau fichier `js/liste.js`** (ajouté à `tools/maj-moteur.sh` et au cache de `sw.js`).
- Nouveaux réglages dans `js/config.js` : `autoNext` (ms, `0` = désactivé), `listeEnabled`, `appId`.
- `autoNext` : après une **bonne** réponse, la bonne réponse passe en vert puis la série continue seule
  (pas d'explication ni de « Continuer ») ; toucher l'écran, ou Entrée, passe tout de suite à la suite ;
  une mauvaise réponse garde l'explication et « Continuer » ; ☆ pendant le délai garde la question à l'écran.
- « Ma liste » : voir plus haut. `sync.js` synchronise aussi la liste (Gist commun).
- `css/style.css` : étoile, page de la liste, message bref ; le tableau `vocab` a une colonne de plus (☆).

### 2026-10-28 — Plusieurs points clés
- La bulle affiche les étiquettes de tous les points clés débloqués (ex. い・な｜て) ; l'antisèche
  a un onglet par point clé.
- Les questions surprises et celles des tests alternent entre les points clés (un point souvent raté
  ne prend plus toute la place).

### 2026-10-22 — Reprise des séries, bouton furigana, série de bonnes réponses
- Bouton 漢 dans la barre du haut (ajouté par le moteur à côté de ⚙) : affiche / masque les furigana
  sans quitter l'exercice.
- Réglages : « ← Retour » ramène à la page précédente (y compris la question en cours), plus à l'accueil.
- La série en cours est gardée sur l'appareil (clé `<storageKey>:seance`) : on peut aller ailleurs,
  recharger ou fermer l'appli et la reprendre ; l'accueil affiche « Série en cours · Reprendre / Abandonner ».
  Relancer la même leçon, le même test ou le même examen reprend la série au lieu de la recommencer.
- Compteur 🔥 de bonnes réponses d'affilée (toutes séries confondues) et record, synchronisés
  (nouveau champ `stats` dans la progression).
- Avec `hideBlankTranslation: true`, chaque phrase à trous doit avoir **une seule réponse possible
  sans la traduction** ; une consigne indispensable va dans `q` (toujours visible), pas dans `fr`.

### 2026-10-22 — Points clés
- Nouveau champ `focus` dans `data/manifest.json` (voir « Format : points clés »).
- Nouveaux réglages dans `js/config.js` : `focusEvery`, `focusInTests`, `focusChallengeSize`.
- Nouveau balisage `==surligné==` ; les sections acceptent `grid` (tableau).
- Réglage utilisateur « Afficher la bulle des points clés » (page Réglages).
- Sur téléphone, les tableaux `grid` s'affichent en fiches (une par ligne, chaque case garde le titre de sa colonne).

### 2026-10-21 — Propositions de l'appli vocabulaire
- `sw.js` : les anciens caches `ng-v1` **et** `nv-v1` sont supprimés ; hors ligne, on ne cherche plus
  que dans le cache de l'appli (avant, un ancien cache pouvait ressortir de vieux fichiers).
- Leçons : champ facultatif `words` (voir plus haut).
- Nouveau réglage `hideBlankTranslation` dans `js/config.js` : dans les phrases à trous, la traduction
  reste cachée derrière « Voir la traduction » jusqu'à la réponse (`true` pour le vocabulaire,
  `false` pour la grammaire).
- `tools/verifier.mjs` lance aussi `tools/verifier-appli.mjs` s'il existe.

### 2026-10-21 — Examens intermédiaires, rappels, moteur partagé
- Séparation moteur / appli : nouveaux fichiers `js/config.js` et `css/theme.css`
  (à créer dans chaque appli ; `index.html` doit charger `css/theme.css` après `css/style.css`).
- Le service worker nomme son cache d'après l'adresse de l'appli et ne supprime que ses propres caches.
- `data/manifest.json` : nouveau champ `"miniExamEvery": 2` → un examen intermédiaire tous les 2 blocs,
  entre les grands examens (`examEvery`).
- Blocs : nouveau champ facultatif `"examTest": [...]` = questions de réflexion réservées à l'examen
  qui suit ce bloc (intermédiaire ou grand). Elles sortent toutes à cet examen, puis reviennent en révision.
- Tests et examens plus longs (30 / 40 / 60 questions par défaut) avec environ 25 % de rappels
  des leçons précédentes.
- Les exercices déjà ratés gardent longtemps plus de chances de revenir ; les exercices réussis
  peuvent revenir aussi (révision libre quand rien n'est à revoir).
- En leçon : 5 rappels mélangés aux exercices, une erreur revient jusqu'à 2 fois dans la série.
