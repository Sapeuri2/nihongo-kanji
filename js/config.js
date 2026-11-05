// Réglages propres à CETTE appli. Le reste de js/ et css/style.css est le moteur partagé
// (voir MOTEUR.md) : ne pas mettre ici de logique, seulement des valeurs.

export const CONFIG = {
  // Stockage : à changer pour chaque appli (elles partagent le domaine sapeuri2.github.io).
  // Ne jamais modifier une fois en ligne, sinon la progression est perdue.
  storageKey: 'nk-state-v1',
  syncKey: 'nk-sync',
  gistFile: 'nihongo-kanji-progression.json',
  gistDescription: 'Progression nihongo-kanji (ne pas supprimer)',
  tokenName: 'nihongo-kanji',
  appId: 'kanji', // nom de l'appli dans « Ma liste »
  autoNext: 700, // ms : après une bonne réponse, passe seul à la question suivante
  listeEnabled: true, // « Ma liste » : mots mis de côté, communs aux applis

  // Pédagogie
  lessonPass: 0.7, // score pour valider une leçon
  testPass: 0.8, // score pour valider un test ou un examen
  lessonRecall: 12, // anciens exercices mélangés à chaque série de leçon (18 nouveaux + 12 = 30)
  testSize: 30, // test de bloc
  miniExamSize: 40, // examen intermédiaire (2 blocs)
  examSize: 60, // grand examen (4 blocs)
  recallShare: 0.25, // part des questions d'un test qui reviennent sur les leçons d'avant
  reviewSize: 20,
  drillSize: 15,
  maxRetries: 2, // en leçon : nombre de fois qu'une question ratée revient dans la même série
  focusEvery: 4, // points clés : une question surprise toutes les N questions (leçons, révisions)
  focusInTests: 3, // points clés : questions ajoutées à chaque test / examen (comptent dans la note)
  focusChallengeSize: 10, // points clés : longueur du défi éclair
  hideBlankTranslation: true, // phrases à trous : traduction cachée derrière « Voir la traduction » jusqu'à la réponse
};
