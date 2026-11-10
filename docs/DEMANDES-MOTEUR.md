# Demandes de code pour l'agent central

Depuis le 2026-11-10, le code des trois applis est géré par l'agent central (dépôt `nihongo-central`).
Ces demandes, écrites à l'origine pour l'instance grammaire, sont reprises dans son backlog.
Le point A1 (`tools/maj-moteur.sh`) est réglé : le script est supprimé.
Partie A : retour sur la mise à jour 720473c dans l'appli kanji. Partie B : nouvelles demandes.

---

## A. Retour sur 720473c (suite automatique + « Ma liste »)

Installé dans nihongo-kanji avec `appId: 'kanji'`, `autoNext: 700`, `listeEnabled: true`.
`node tools/verifier.mjs` OK. Testé dans le navigateur : ☆ dans les fiches et après une question,
page 📌 `#/liste`, « Réviser ma liste », export Anki (CSV correct). Le tableau `vocab` tient en 390 px sans débordement.

**autoNext 700 : bien.** Une bonne réponse passe en vert puis la question suivante arrive ; une mauvaise garde
l'explication et « Continuer ». 700 ms convient aux réponses courtes des kanji, on garde ce délai.

**1. `tools/maj-moteur.sh` s'écrase lui-même pendant qu'il tourne.**
Au premier lancement, bash lit le script au fur et à mesure ; la copie de la nouvelle version au milieu
de l'exécution donne `line 45: syntax error near unexpected token '('`, et `js/liste.js` n'est pas copié
(l'ancienne liste FILES ne le contient pas). Un second lancement marche.
→ Correctif proposé : mettre tout le corps du script dans une fonction appelée à la dernière ligne
(`main() { … }; main "$@"; exit`), ou copier `tools/maj-moteur.sh` en dernier via un fichier temporaire + `mv`.

**2. ☆ après une question enregistre souvent un mauvais mot dans les kanji.** Ce que garde `entryOf` :

| Exercice kanji | Ce qui est enregistré | Ce qu'il faudrait |
| --- | --- | --- |
| « Que veut dire ce kanji ? » 私 | jp 私, kana 私, fr = toute l'explication (mémo compris) | 私 · わたし · je, moi |
| « Comment se lit **日本** ? » | jp にほん (la lecture seule) | {日本\|にほん} · Japon |
| « Complète le mot にほん » (＿本) | jp 本 (la réponse seule) | {日本\|にほん} · Japon |
| « Un seul de ces mots est mal lu » | jp « 日本 → かほん » | {日本\|にほん} · Japon |
| « Dans **日本** (にほん), 本 est lu comment ? » | jp にほん | {日本\|にほん} · Japon |
| Phrase « Comment se lit le mot en gras ? » | la phrase entière, fr = explication | le mot en gras |

→ **Changement demandé (petit)** : si l'exercice a un champ **`star`** (`{ jp, kana, fr }`), le ☆ l'utilise tel quel
au lieu de deviner ; `star: null` = pas de ☆ sur cette question. Sans champ, comportement actuel.
Tous les exercices de l'appli kanji ont déjà ce champ (ex. `"star": { "jp": "{日本|にほん}", "kana": "にほん", "fr": "Japon" }`) ;
pour un kanji seul : `{ "jp": "回", "kana": "カイ、まわ(る)、まわ(す)", "fr": "fois, tourner" }`.
À documenter dans MOTEUR.md (format des exercices) ; la grammaire et le vocabulaire peuvent s'en servir aussi.

**3. Détail d'affichage** : sur `#/liste`, avec les furigana affichés, la lecture apparaît deux fois (« 日本にほん にほん »).
Masquer la colonne kana quand le mot a déjà des furigana visibles, ou ne garder que l'une des deux.

---

## B. Nouvelles demandes

Contexte (l'utilisateur) : « Je viens d'arriver au N4. Sur le moment je valide tout, mais après ça ne revient plus vraiment,
et je sais que si ça ne revient pas je vais oublier. Il faut que tout revienne au moins sur 4 ou 5 jours,
sans pour autant rendre les leçons trop longues. » L'utilisateur apprend en répétant jusqu'à ce que ça reste :
le moteur doit l'aider à revoir **au bon moment**, et collecter de quoi l'optimiser.

### B1. Révisions par carte (répétition espacée sur ce qu'on apprend, pas sur une question)

Aujourd'hui la répétition espacée (Leitner) suit chaque **exercice** : la même question revient, on la reconnaît,
et les autres formes du même mot ne comptent pas.

- Nouveau champ facultatif d'exercice **`card`** : l'identifiant de ce qu'on apprend (un kanji, un mot, un point de grammaire).
  Plusieurs exercices partagent la même carte (sens, lecture, trou, phrase…). L'appli kanji le fournit déjà partout
  (769 cartes pour 1 693 exercices). Sans `card`, la carte = l'exercice (comportement actuel).
- État Leitner **par carte** (en plus de celui par exercice) : une carte est due → on pose **une** de ses questions,
  en prenant de préférence une forme différente de la dernière fois (et la moins récemment vue).
- Intervalles réglables : **`intervals`** dans `js/config.js` (défaut `[0, 1, 3, 7, 16, 35]`).
  Kanji : `[0, 1, 2, 4, 7, 15, 30, 60]` → une leçon revient à J+1, J+3, J+7, J+14 (au moins 4 fois la première quinzaine).
- Erreur → la carte revient en boîte 0 (à revoir demain) et est marquée **fragile** (affichée comme telle).
- **Bonne réponse lente** (au-delà de **`slowMs`**, ex. 8000 pour les kanji, 0 = désactivé) : la carte ne monte pas de boîte.
- **« Révisions du jour »** : carte en haut de l'accueil, AVANT la leçon suivante (« 23 cartes à revoir · ~6 min »),
  séance limitée à **`dailyReviewMax`** (ex. 30) cartes, les plus en retard et les plus fragiles d'abord.
- Garde-fou **`reviewGate`** (0 = aucun) : si plus de N cartes sont en retard, ouvrir une nouvelle leçon affiche
  « Tu as N révisions en retard : les faire d'abord ? » (Réviser / Continuer quand même).
- Les révisions ne rallongent pas les leçons : c'est une séance à part.

### B2. Collecte des réponses + page « Statistiques »

- Pour chaque réponse, garder : `{ t, id, card, ok, choisi, ms, kind }` (`choisi` = texte de la mauvaise réponse
  choisie, `ms` = temps de réponse, `kind` = leçon / révision / test / examen / liste).
  Synchronisé dans le Gist comme le reste ; plafonné (ex. 10 000 dernières réponses).
- Page **`#/stats`** :
  - mes **confusions** (paires « réponse attendue → ce que j'ai choisi » les plus fréquentes), avec un bouton
    « S'entraîner sur ces confusions » (questions où les deux sont face à face) ;
  - cartes **fragiles** et cartes **lentes** ;
  - taux d'oubli par boîte (pour ajuster les intervalles) ; formes de question les plus ratées ;
  - export JSON du journal.
- Utiliser ces données dans B1 : les cartes confondues ou lentes reviennent plus tôt.

### B3. Leçons plus longues, rappels du niveau en cours uniquement

- L'appli kanji passe à 18 questions nouvelles + `lessonRecall: 12` = 30 par leçon (déjà fait côté données et config).
- **Demandé** : nouveau réglage **`recallScope`** : `'all'` (actuel) ou `'level'` = les rappels d'une leçon sont tirés
  uniquement des leçons déjà faites **du même niveau** (`level` du bloc). Exception : dans le **premier bloc** d'un niveau,
  les rappels peuvent venir du niveau précédent. Kanji : `recallScope: 'level'`.
- Même règle pour la part de rappels des tests (`recallShare`).

### B4. Nouveau type d'exercice : saisie au clavier japonais (`input`)

À partir du N4, des questions où il faut **taper** la réponse (pour augmenter la difficulté).

```json
{ "id": "…", "type": "input", "q": "**降る**の読み方は？", "answers": ["ふる"], "script": "hiragana",
  "jp": "…facultatif…", "explain": "…", "card": "降る", "star": { "jp": "{降|ふ}る", "kana": "ふる", "fr": "tomber (pluie)" } }
```

- `answers` : toutes les réponses acceptées. `script` : `hiragana`, `katakana` ou `any`
  (`hiragana` refuse une réponse en katakana et inversement ; `any` accepte les deux).
- Normaliser avant de comparer : espaces, pleine/demi-chasse, `ー` / `-`, ponctuation finale.
- Clavier de téléphone : ne pas valider pendant la composition (attendre `compositionend` avant Entrée),
  `autocapitalize="off"`, `autocomplete="off"`, `lang="ja"` sur le champ.
- En cas d'erreur : afficher la réponse attendue ; si la réponse tapée est une autre lecture du même kanji,
  le dire (« c'est une lecture de 降, mais pas dans ce mot »).
- Compte comme les autres réponses (score, Leitner, 🔥, journal B2).
Je générerai ensuite côté kanji : lecture d'un mot, trou dans une phrase, mots en katakana, français → hiragana.

### B5. Grille de 20 choix (examen de fin de niveau)

- Quand `choices.length > 6`, afficher les choix en **grille** (5 × 4 sur téléphone, sans débordement à 390 px),
  sans numéros. Usage : « fois, tourner » → trouver 回 parmi 20, pour chaque kanji du niveau.
- Facultatif : `"layout": "grid"` sur l'exercice pour forcer la grille.

### B6. Nouveau type d'exercice : écrire le kanji soi-même (`draw`)

```json
{ "id": "…", "type": "draw", "q": "Écris le kanji de « fois, tourner »", "answer": "回", "hint": "まわる", "card": "回" }
```

- Une zone de dessin (doigt ou souris), boutons « Effacer » et « Voir la réponse ».
- Après « Voir la réponse » : le kanji attendu s'affiche à côté du tracé, et l'utilisateur se note : « Juste » / « Faux ».
  La note compte comme une réponse normale (Leitner par carte, journal).
- Pas de reconnaissance automatique : l'auto-évaluation suffit.

### B7. Examen de fin de niveau complet

- Bloc avec `"fullExam": true` : son examen pose **toutes** les questions de `examTest`, dans un ordre mélangé,
  sans tirage. Usage kanji : à la fin du N5 et du N4, chaque kanji du niveau en français → kanji parmi 20 (B5),
  plus une sélection en tracé (B6) et en saisie (B4).

### Ordre conseillé

B1 + B2 d'abord (c'est ce qui fait retenir), puis B3 (petit), B4, puis B5 à B7. Le correctif A2 (`star`) est très petit
et peut passer tout de suite.
Pour chaque point : nouveau réglage dans `js/config.js` du moteur avec une valeur par défaut qui ne change rien
pour les applis qui ne l'utilisent pas, une ligne d'historique et le format dans `MOTEUR.md`.
