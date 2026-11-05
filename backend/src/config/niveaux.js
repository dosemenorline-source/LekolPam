// Niveaux scolaires (système éducatif haïtien), DANS L'ORDRE de progression :
// préscolaire → fondamentale 1-9 → nouveau secondaire NS1-NS4. L'ordre sert à
// la ré-inscription (promotion : passage au niveau suivant). Liste fermée : la
// saisie libre historique a produit des valeurs incohérentes qu'un menu élimine.
export const NIVEAUX = [
  '1ère année préscolaire', '2e année préscolaire', '3e année préscolaire',
  '1ère AF', '2e AF', '3e AF', '4e AF', '5e AF', '6e AF', '7e AF', '8e AF', '9e AF',
  'NS1', 'NS2', 'NS3', 'NS4',
];

// Niveau suivant dans la progression. Si le niveau est inconnu ou déjà le
// dernier (NS4), on renvoie le même niveau (pas de « niveau au-dessus »).
export function niveauSuivant(niveau) {
  const i = NIVEAUX.indexOf(niveau);
  if (i === -1 || i === NIVEAUX.length - 1) return niveau;
  return NIVEAUX[i + 1];
}

// Vrai si le niveau est le dernier de la progression (fin du secondaire).
export function estDernierNiveau(niveau) {
  return NIVEAUX.indexOf(niveau) === NIVEAUX.length - 1;
}
