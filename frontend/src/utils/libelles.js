// Libellés partagés
export const TYPES_FRAIS = [
  { valeur: 'inscription', libelle: "Frais d'inscription" },
  { valeur: 'releve', libelle: 'Relevé de notes' },
  { valeur: 'duplicata', libelle: 'Duplicata' },
];
export const libelleTypeFrais = (t) => TYPES_FRAIS.find((x) => x.valeur === t)?.libelle || t;

export const montantFr = (montant, devise) =>
  `${Number(montant).toFixed(2)} ${devise || 'HTG'}`;

export const dateFr = (s) => (s ? new Date(s).toLocaleDateString('fr-FR') : '');
export const dateHeureFr = (s) => (s ? new Date(s).toLocaleString('fr-FR') : '');

// Année scolaire courante, calculée automatiquement à partir de la date du jour.
// La nouvelle année devient courante à la rentrée (septembre) : à partir de
// septembre AAAA, l'année scolaire est « AAAA-(AAAA+1) », sinon « (AAAA-1)-AAAA ».
export function anneeScolaireCourante(date = new Date()) {
  const annee = date.getFullYear();
  const mois = date.getMonth() + 1; // 1 = janvier … 12 = décembre
  return mois >= 9 ? `${annee}-${annee + 1}` : `${annee - 1}-${annee}`;
}

// Niveaux scolaires proposés à l'inscription (système éducatif haïtien :
// préscolaire, fondamentale 1-9, nouveau secondaire NS1-NS4). Doit rester
// synchronisé avec la liste équivalente côté serveur (inscription.controller.js).
export const NIVEAUX_GROUPES = [
  { groupe: 'Préscolaire', niveaux: ['1ère année préscolaire', '2e année préscolaire', '3e année préscolaire'] },
  { groupe: 'Fondamentale', niveaux: ['1ère AF', '2e AF', '3e AF', '4e AF', '5e AF', '6e AF', '7e AF', '8e AF', '9e AF'] },
  { groupe: 'Secondaire (Nouveau Secondaire)', niveaux: ['NS1', 'NS2', 'NS3', 'NS4'] },
];

export const libelleSexe = (s) => (s === 'M' ? 'Masculin' : s === 'F' ? 'Féminin' : '');

// Âge en années révolues à partir d'une date de naissance (ISO ou Date-like).
export function calculerAge(dateNaissance) {
  if (!dateNaissance) return null;
  const naissance = new Date(dateNaissance);
  if (Number.isNaN(naissance.getTime())) return null;
  const aujourdhui = new Date();
  let age = aujourdhui.getFullYear() - naissance.getFullYear();
  const avantAnniversaire = aujourdhui.getMonth() < naissance.getMonth()
    || (aujourdhui.getMonth() === naissance.getMonth() && aujourdhui.getDate() < naissance.getDate());
  if (avantAnniversaire) age -= 1;
  return age;
}

// Tarif courant pour un type (date effective la plus récente <= aujourd'hui)
export function tarifCourant(tarifs, typeFrais) {
  const aujourd = new Date().toISOString().slice(0, 10);
  return tarifs
    .filter((t) => t.type_frais === typeFrais && t.date_effective.slice(0, 10) <= aujourd)
    .sort((a, b) => b.date_effective.localeCompare(a.date_effective))[0] || null;
}
