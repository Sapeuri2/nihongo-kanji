// État partagé de l'appli ouverte (cours chargé, série en cours, page précédente) et petits outils de navigation.
export const ctx = {
  C: null, // le cours chargé
  session: null, // la série d'exercices en cours
  prevHash: '#/', // page d'où l'on vient (bouton Retour des réglages et de Ma liste)
  render: () => {}, // redessine la page (fourni par app.js au démarrage)
};

export function go(hash) {
  location.hash = hash;
  return '';
}
