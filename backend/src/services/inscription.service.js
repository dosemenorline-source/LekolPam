// Service Inscription — logique métier des changements de statut + notification courriel
import { trouverAvecProprietaire, mettreAJourStatut, STATUTS_NON_PAYES, appliquerNiveauEleve } from '../models/inscription.model.js';
import { trouverPourInscription } from '../models/paiement.model.js';
import { journaliser } from '../models/historique.model.js';
import { envoyerCourriel } from '../config/mailer.js';
import { envoyerSms } from '../config/sms.js';
import { echapperHtml } from '../utils/html.js';

// Statuts que le secrétariat peut appliquer depuis ce module
const STATUTS_ADMIN = ['accepte', 'refuse', 'complement_demande'];

const LIBELLES = {
  accepte: 'accepté',
  refuse: 'refusé',
  complement_demande: 'en attente de complément',
  confirmee: 'confirmé',
  en_attente: 'en attente',
};

// Résultat : { ok: true, previewUrl } | { ok: false, code, erreur }
export async function changerStatut({ idInscription, nouveauStatut, commentaire, idAuteur }) {
  const inscription = await trouverAvecProprietaire(idInscription);
  if (!inscription || STATUTS_NON_PAYES.includes(inscription.statut)) {
    return { ok: false, code: 404, erreur: 'Inscription introuvable.' };
  }

  // Règle : « confirmee » est réservé au module Paiement
  if (nouveauStatut === 'confirmee') {
    return {
      ok: false,
      code: 409,
      erreur: "Le statut « confirmée » est fixé par la validation du paiement, pas ici.",
    };
  }
  if (!STATUTS_ADMIN.includes(nouveauStatut)) {
    return { ok: false, code: 400, erreur: 'Statut invalide.' };
  }

  // Frais déjà payés à la soumission du dossier : l'accepter le confirme
  // directement (l'ancien parcours « accepté puis payé » reste valable pour
  // les dossiers antérieurs, encore impayés).
  if (nouveauStatut === 'accepte') {
    const paiement = await trouverPourInscription(idInscription);
    if (paiement?.statut === 'valide') nouveauStatut = 'confirmee';
  }

  const ancienStatut = inscription.statut;
  await mettreAJourStatut(idInscription, nouveauStatut);

  // Ré-inscription : si le dossier portait un niveau demandé (promotion) et qu'il
  // est accepté/confirmé, on applique ce niveau à l'élève. C'est ici que l'élève
  // « monte de classe » (ou reste dans la même) pour la nouvelle année.
  if ((nouveauStatut === 'accepte' || nouveauStatut === 'confirmee') && inscription.niveau_demande) {
    try {
      await appliquerNiveauEleve(inscription.id_eleve, inscription.niveau_demande);
    } catch (err) {
      console.error('Application du niveau (ré-inscription) échouée :', err.message);
    }
  }

  await journaliser({
    entite: 'inscription',
    idEntite: idInscription,
    ancienStatut,
    nouveauStatut,
    commentaire,
    idAuteur,
  });

  // Notification courriel au parent
  const libelle = LIBELLES[nouveauStatut] || nouveauStatut;
  const sujet = `Lekòl Pam — dossier ${libelle}`;
  const corps =
    `Bonjour ${inscription.parent_nom},\n\n` +
    `Le statut du dossier d'inscription de ${inscription.eleve_nom} ` +
    `(année ${inscription.annee_scolaire}) est maintenant : ${libelle}.\n` +
    (commentaire ? `\nMessage du secrétariat : ${commentaire}\n` : '') +
    `\nConnectez-vous à votre compte pour plus de détails.`;
  const html =
    `<p>Bonjour ${echapperHtml(inscription.parent_nom)},</p>` +
    `<p>Le statut du dossier d'inscription de <strong>${echapperHtml(inscription.eleve_nom)}</strong> ` +
    `(année ${echapperHtml(inscription.annee_scolaire)}) est maintenant : <strong>${echapperHtml(libelle)}</strong>.</p>` +
    (commentaire ? `<p>Message du secrétariat : ${echapperHtml(commentaire)}</p>` : '') +
    `<p>Connectez-vous à votre compte pour plus de détails.</p>`;

  let previewUrl = null;
  try {
    ({ previewUrl } = await envoyerCourriel({
      to: inscription.parent_courriel,
      subject: sujet,
      text: corps,
      html,
    }));
  } catch (err) {
    // L'envoi du courriel ne doit pas annuler le changement de statut déjà enregistré.
    console.error('Notification courriel échouée :', err.message);
  }

  if (inscription.telephone_parent) {
    try {
      await envoyerSms({ to: inscription.telephone_parent, texte: corps });
    } catch (err) {
      console.error('Notification SMS échouée :', err.message);
    }
  }

  return { ok: true, ancienStatut, nouveauStatut, previewUrl };
}
