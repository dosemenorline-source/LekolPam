// Badge de statut — nuances de bleu/gris (palette imposée)
const STATUTS = {
  // en attente / neutre
  en_attente: { texte: 'En attente', classe: 'badge-neutre' },
  saisie: { texte: 'Saisie', classe: 'badge-neutre' },
  complement_demande: { texte: 'Complément demandé', classe: 'badge-contour' },
  attente_paiement: { texte: 'En attente de paiement', classe: 'badge-contour' },
  // positifs (bleu)
  accepte: { texte: 'Accepté', classe: 'badge-bleu' },
  valide: { texte: 'Validé', classe: 'badge-bleu' },
  validee: { texte: 'Validée', classe: 'badge-bleu' },
  confirmee: { texte: 'Confirmée', classe: 'badge-plein' },
  publie: { texte: 'Publié', classe: 'badge-plein' },
  // négatifs (contour gris — pas de rouge décoratif)
  refuse: { texte: 'Refusé', classe: 'badge-contour' },
  rejete: { texte: 'Rejeté', classe: 'badge-contour' },
  annulee: { texte: 'Annulée', classe: 'badge-contour' },
};

export default function Badge({ statut, children }) {
  const conf = STATUTS[statut] || { texte: children || statut, classe: 'badge-neutre' };
  return <span className={`badge ${conf.classe}`}>{children || conf.texte}</span>;
}
