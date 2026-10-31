# Le moteur partagé

Le code de cette appli sert de **moteur commun** à plusieurs applis d'apprentissage
(grammaire, vocabulaire…). Le dépôt de référence du moteur est
[Sapeuri2/nihongo-grammaire](https://github.com/Sapeuri2/nihongo-grammaire).

## Fichiers du moteur (identiques dans toutes les applis)

| Fichier | Rôle |
| --- | --- |
| `js/app.js` | Navigation, leçons, exercices, tests, examens, révisions |
| `js/state.js` | Progression, répétition espacée, fusion entre appareils |
| `js/sync.js` | Synchronisation via un Gist GitHub privé |
| `js/text.js` | Furigana `{漢字|かんじ}`, gras, trous |
| `css/style.css` | Apparence commune |
| `sw.js` | Hors ligne (cache nommé d'après l'adresse de l'appli) |
| `tools/verifier.mjs` | Vérification du contenu |
| `tools/maj-moteur.sh` | Mise à jour du moteur dans une autre appli |
| `MOTEUR.md` | Ce fichier |

## Fichiers propres à chaque appli (jamais écrasés)

| Fichier | Contenu |
| --- | --- |
| `js/config.js` | Clés de stockage, nom du fichier Gist, réglages pédagogiques |
| `css/theme.css` | Couleur principale (rouge pour la grammaire, bleu pour le vocabulaire…) |
| `index.html`, `manifest.webmanifest`, `icons/` | Nom, icône, couleur de la barre du téléphone |
| `data/` | Le contenu (leçons, exercices) |
| `tools/verifier-appli.mjs` | Facultatif : contrôles propres à l'appli, lancés par `tools/verifier.mjs` (code de sortie ≠ 0 = échec) |
| `README.md`, `PROGRAMME.md` | Documentation de l'appli |

## Mettre à jour le moteur d'une autre appli

Depuis la racine du dépôt de l'appli :

```sh
bash tools/maj-moteur.sh
```

Le script recopie les fichiers du moteur, puis signale les **nouveaux réglages** à ajouter
dans `js/config.js` (avec leur valeur dans la grammaire). Ensuite :

1. ajouter ces réglages dans `js/config.js` ;
2. lancer `node tools/verifier.mjs` (le contenu peut devoir suivre un nouveau format, voir l'historique) ;
3. tester l'appli, puis commit et push.

**Règle d'or : ne pas modifier les fichiers du moteur dans une autre appli.** Une amélioration
du moteur (nouveau type d'exercice, correctif…) se fait dans le dépôt grammaire, puis se
propage avec le script. Si une appli en a besoin, décrire le changement à l'utilisateur
pour qu'il le fasse faire côté grammaire.

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

## Historique des changements du moteur

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
