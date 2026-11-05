// Service Paiement — création de demande, validation, confirmation / génération de documents
import * as paiementModel from '../models/paiement.model.js';
import { tarifCourant } from '../models/tarif.model.js';
import { obtenir as obtenirEcole } from '../models/ecole.model.js';
import {
  trouverAvecProprietaire as trouverInscription, mettreAJourStatut as majInscription,
  transmettreApresPaiement, annulerSiNonPayee, listerNonPayeesExpirees, STATUTS_NON_PAYES,
  appliquerNiveauEleve,
} from '../models/inscription.model.js';
import { trouverAvecProprietaire as trouverEleve, genererCodeAcces } from '../models/eleve.model.js';
import { notesValideesToutes } from '../models/note.model.js';
import { creer as creerDocumentOfficiel } from '../models/documentOfficiel.model.js';
import { journaliser } from '../models/historique.model.js';
import { grouperTranscript, genererReleve } from './releve.service.js';
import { envoyerCourriel } from '../config/mailer.js';
import { envoyerSms } from '../config/sms.js';
import {
  clientIA, iaConfiguree, MODELE_IA, MARQUEUR_ELEVE, MARQUEUR_PARENT, CONSIGNE_MARQUEURS, restaurerMarqueurs,
} from '../config/ia.js';
import {
  plopplopConfigure, creerPaiementPlopplop, verifierPaiementPlopplop, METHODES_VALIDES,
} from '../config/plopplop.js';
import { alerter } from './securite.service.js';
import crypto from 'crypto';

const TYPES = ['inscription', 'releve', 'duplicata'];
const LIBELLE_TYPE = {
  inscription: "les frais d'inscription", releve: 'le relevé de notes', duplicata: 'le duplicata',
};

// Message envoyé au parent à l'issue d'un paiement (validé ou rejeté), adapté
// au contexte (type de frais, motif du rejet le cas échéant) via l'IA (Groq).
// Repli sur un message générique si l'IA n'est pas configurée ou échoue — la
// notification ne doit jamais dépendre de la disponibilité de l'IA.
async function genererMessagePaiement({
  statut, typeFrais, montant, devise, commentaire, parentNom, eleveNom, dossierTransmis,
}) {
  const salutation = `Bonjour ${parentNom || ''},\n\n`;
  let fallback;
  if (statut === 'rejete') {
    fallback = `${salutation}Votre preuve de paiement a été rejetée.` +
      (commentaire ? `\nMotif : ${commentaire}` : '') +
      `\nVeuillez soumettre une nouvelle preuve.`;
  } else if (typeFrais === 'inscription' && dossierTransmis) {
    fallback = `${salutation}Le paiement des frais d'inscription a été reçu. Le dossier de ${eleveNom} `
      + 'est transmis au secrétariat, qui vous informera de sa décision.';
  } else if (typeFrais === 'inscription') {
    fallback = `${salutation}Le paiement a été validé. L'inscription de ${eleveNom} est maintenant confirmée.`;
  } else {
    const libelle = typeFrais === 'duplicata' ? 'duplicata' : 'relevé de notes';
    fallback = `${salutation}Le paiement a été validé. Votre ${libelle} pour ${eleveNom} est disponible dans votre compte.`;
  }

  if (!iaConfiguree()) return fallback;
  try {
    const client = clientIA();
    const completion = await client.chat.completions.create({
      model: MODELE_IA,
      temperature: 0.5,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: "Tu rédiges, au nom de l'économat de l'école « Lekòl Pam », le corps d'un courriel court (3 à 5 phrases, sans salutation ni signature — elles sont ajoutées séparément) informant un parent de l'issue du traitement d'un paiement. Sois clair, professionnel et bienveillant. Si le paiement est rejeté, explique le motif donné sans le déformer et indique clairement l'action attendue (soumettre une nouvelle preuve). Si le paiement est validé, confirme ce que cela débloque concrètement. N'invente STRICTEMENT AUCUN détail (montant, date, lieu, procédure de retrait, moyen de contact) qui n'est pas fourni explicitement dans le message de l'utilisateur — base-toi UNIQUEMENT sur le contexte « Ce que cela débloque » donné ci-dessous, ne décris pas d'autre démarche. Pas d'emojis, pas de titre. " + CONSIGNE_MARQUEURS,
        },
        {
          role: 'user',
          content: `Élève concerné : ${MARQUEUR_ELEVE}.\n`
            + `Type de frais : ${LIBELLE_TYPE[typeFrais] || typeFrais}.\n`
            + `Montant : ${montant != null ? `${Number(montant).toFixed(2)} ${devise}` : 'non précisé'}.\n`
            + `Décision : ${statut === 'rejete' ? 'rejeté' : 'validé'}.\n`
            + (statut === 'rejete'
              ? `Motif du rejet : ${commentaire || 'non précisé'}.\n`
              : `Ce que cela débloque (ne décris rien d'autre) : ${
                typeFrais === 'inscription' && dossierTransmis
                  ? `le dossier d'inscription de ${MARQUEUR_ELEVE} est transmis au secrétariat, qui l'examinera et informera le parent de sa décision (l'inscription n'est PAS encore acceptée).`
                  : typeFrais === 'inscription'
                  ? `l'inscription de ${MARQUEUR_ELEVE} est confirmée dans le système.`
                  : `le document (${LIBELLE_TYPE[typeFrais] || typeFrais}) est téléchargeable en ligne, dans l'espace parent du site — aucun retrait physique n'est nécessaire.`
              }\n`)
            + 'Rédige le corps du courriel pour ce parent.',
        },
      ],
    });
    const texte = restaurerMarqueurs((completion.choices?.[0]?.message?.content || '').trim(), { eleve: eleveNom });
    return texte ? `${salutation}${texte}` : fallback;
  } catch (err) {
    console.error('Message paiement IA échoué :', err.message);
    return fallback;
  }
}

// Résout le propriétaire + l'élève concerné selon le type de frais
async function resoudreProprietaire(typeFrais, idReference) {
  if (typeFrais === 'inscription') {
    const ins = await trouverInscription(idReference);
    if (!ins) return null;
    return {
      idUtilisateur: ins.id_utilisateur, idEleve: ins.id_eleve, eleveNom: ins.eleve_nom,
      eleveNiveau: ins.niveau, parentCourriel: ins.parent_courriel, parentNom: ins.parent_nom,
      parentTelephone: ins.telephone_parent,
      inscription: ins,
    };
  }
  const eleve = await trouverEleve(idReference);
  if (!eleve) return null;
  return {
    idUtilisateur: eleve.id_utilisateur, idEleve: eleve.id, eleveNom: eleve.nom,
    eleveNiveau: eleve.niveau, parentCourriel: eleve.parent_courriel, parentNom: eleve.parent_nom,
    parentTelephone: eleve.telephone_parent,
  };
}

// Crée une demande de paiement. Le montant est saisi par le parent (ce qu'il a
// réellement déposé) : le secrétariat le confronte à la photo du reçu pendant
// la validation, plutôt que d'imposer le montant du tarif côté serveur.
// Retourne { ok, code?, erreur?, paiement, coordonnees }
export async function creerDemande({ typeFrais, idReference, montant, idUtilisateur }) {
  if (!TYPES.includes(typeFrais)) return { ok: false, code: 400, erreur: 'Type de frais invalide.' };
  if (!idReference) return { ok: false, code: 400, erreur: 'idReference requis.' };
  if (!Number.isFinite(montant) || montant <= 0) {
    return { ok: false, code: 400, erreur: 'Montant invalide.' };
  }

  const prop = await resoudreProprietaire(typeFrais, idReference);
  if (!prop) return { ok: false, code: 404, erreur: 'Référence introuvable.' };
  if (prop.idUtilisateur !== idUtilisateur) return { ok: false, code: 403, erreur: 'Accès refusé.' };

  if (typeFrais === 'inscription') {
    if (prop.inscription.statut === 'confirmee') {
      return { ok: false, code: 409, erreur: 'Cette inscription est déjà confirmée.' };
    }
    if (prop.inscription.statut !== 'accepte') {
      return { ok: false, code: 409, erreur: "L'inscription doit être acceptée avant le paiement." };
    }
  }

  const tarif = await tarifCourant(typeFrais);
  if (!tarif) return { ok: false, code: 409, erreur: 'Aucun tarif configuré pour ce type de frais.' };

  const id = await paiementModel.creer({
    typeFrais, idReference, montant, devise: tarif.devise,
  });

  const ecole = await obtenirEcole();
  return {
    ok: true,
    paiement: { id, typeFrais, idReference, montant, devise: tarif.devise, statut: 'en_attente' },
    coordonnees: {
      nom: ecole?.nom || 'Lekòl Pam',
      bancaires: ecole?.coordonnees_bancaires || null,
      moncash: ecole?.coordonnees_moncash || null,
    },
  };
}

async function nomEcole() {
  const ecole = await obtenirEcole();
  return ecole?.nom || 'Lekòl Pam';
}

// Génère un relevé (ou duplicata) pour un élève et l'archive
async function genererDocument(prop, duplicata) {
  const notes = await notesValideesToutes(prop.idEleve);
  const groupes = grouperTranscript(notes);
  const { urlPdf, identifiantUnique } = await genererReleve({
    eleve: { nom: prop.eleveNom, niveau: prop.eleveNiveau },
    groupes, ecoleNom: await nomEcole(), duplicata,
  });
  const type = duplicata ? 'duplicata' : 'releve';
  const idDoc = await creerDocumentOfficiel({ idEleve: prop.idEleve, type, urlPdf, identifiantUnique });
  return { idDoc, type, identifiantUnique };
}

// Valide ou rejette un paiement. Retourne { ok, code?, erreur?, previewUrl, document? }
// noteAuteur (facultatif) : identité à tracer dans l'historique interne
// uniquement (ex. e-mail d'un compte Économat, qui n'a pas d'idAdmin FK-
// compatible) — ne doit JAMAIS atteindre le parent, contrairement à commentaire.
export async function traiterValidation({ idPaiement, statut, commentaire, idAdmin, noteAuteur }) {
  if (statut !== 'valide' && statut !== 'rejete') {
    return { ok: false, code: 400, erreur: "statut doit être 'valide' ou 'rejete'." };
  }
  const paiement = await paiementModel.trouverParId(idPaiement);
  if (!paiement) return { ok: false, code: 404, erreur: 'Paiement introuvable.' };
  if (paiement.statut !== 'en_attente') {
    return { ok: false, code: 409, erreur: 'Ce paiement a déjà été traité.' };
  }
  // Un paiement mobile (moncash/natcash/kashpaw) n'a pas de preuve téléversée :
  // la vérification server-à-serveur auprès de plopplop (confirmerPaiementMobile)
  // en tient lieu. Un paiement manuel (ou sans méthode reconnue) exige une preuve.
  if (statut === 'valide' && !METHODES_VALIDES.includes(paiement.methode_paiement) && !paiement.preuve_url) {
    return { ok: false, code: 400, erreur: 'Aucune preuve téléversée : validation impossible.' };
  }

  const prop = await resoudreProprietaire(paiement.type_frais, paiement.id_reference);

  const commentaireHistorique = noteAuteur
    ? (commentaire ? `${noteAuteur} ${commentaire}` : noteAuteur)
    : commentaire;

  const priseEnCompte = await paiementModel.mettreAJourValidation(idPaiement, { statut, validePar: idAdmin });
  if (!priseEnCompte) {
    // Un autre appel concurrent (retour parent, relance manuelle, cycle de
    // reconciliation) a déjà fait la transition entre notre lecture ci-dessus
    // et cet appel — on s'arrête net, sans dupliquer document/notification.
    return { ok: true, statut: (await paiementModel.trouverParId(idPaiement)).statut };
  }
  await journaliser({
    entite: 'paiement', idEntite: idPaiement, ancienStatut: 'en_attente',
    nouveauStatut: statut, commentaire: commentaireHistorique, idAuteur: idAdmin,
  });

  let document = null;
  let sujet;
  let dossierTransmis = false;

  if (statut === 'rejete') {
    sujet = 'Lekòl Pam — paiement rejeté';
  } else if (paiement.type_frais === 'inscription' && STATUTS_NON_PAYES.includes(prop?.inscription?.statut)) {
    // Frais payés à la soumission du dossier : il est maintenant transmis au
    // secrétariat (même s'il avait été annulé entre-temps — le paiement a
    // abouti après le délai, l'argent du parent ne doit pas être perdu).
    dossierTransmis = true;
    if (await transmettreApresPaiement(paiement.id_reference)) {
      await journaliser({
        entite: 'inscription', idEntite: paiement.id_reference,
        ancienStatut: prop.inscription.statut, nouveauStatut: 'en_attente',
        commentaire: "Frais d'inscription payés — dossier transmis au secrétariat", idAuteur: idAdmin,
      });
      try {
        await genererCodeAcces(prop.idEleve);
      } catch (err) {
        console.error('Génération du code élève échouée :', err.message);
      }
    }
    sujet = 'Lekòl Pam — dossier transmis au secrétariat';
  } else if (paiement.type_frais === 'inscription') {
    await majInscription(paiement.id_reference, 'confirmee');
    // Ré-inscription : appliquer la promotion de niveau à la confirmation.
    if (prop?.inscription?.niveau_demande) {
      try {
        await appliquerNiveauEleve(prop.idEleve, prop.inscription.niveau_demande);
      } catch (err) {
        console.error('Application du niveau (ré-inscription) échouée :', err.message);
      }
    }
    await journaliser({
      entite: 'inscription', idEntite: paiement.id_reference,
      ancienStatut: prop?.inscription?.statut || 'accepte', nouveauStatut: 'confirmee',
      commentaire: 'Paiement validé', idAuteur: idAdmin,
    });
    sujet = 'Lekòl Pam — inscription confirmée';
  } else {
    const duplicata = paiement.type_frais === 'duplicata';
    document = await genererDocument(prop, duplicata);
    const libelle = duplicata ? 'duplicata' : 'relevé de notes';
    sujet = `Lekòl Pam — ${libelle} disponible`;
  }

  const corps = await genererMessagePaiement({
    statut, typeFrais: paiement.type_frais, montant: paiement.montant, devise: paiement.devise,
    commentaire, parentNom: prop?.parentNom, eleveNom: prop?.eleveNom, dossierTransmis,
  });

  let previewUrl = null;
  try {
    if (prop?.parentCourriel) {
      ({ previewUrl } = await envoyerCourriel({ to: prop.parentCourriel, subject: sujet, text: corps }));
    }
  } catch (err) {
    console.error('Notification paiement échouée :', err.message);
  }

  if (prop?.parentTelephone) {
    try {
      await envoyerSms({ to: prop.parentTelephone, texte: corps });
    } catch (err) {
      console.error('Notification SMS paiement échouée :', err.message);
    }
  }

  return { ok: true, statut, document, previewUrl };
}

// Résout la propriété d'un paiement pour le contrôle d'accès (renvoie idUtilisateur ou null)
export async function proprietaireDe(paiement) {
  const prop = await resoudreProprietaire(paiement.type_frais, paiement.id_reference);
  return prop ? prop.idUtilisateur : null;
}

// Démarre un paiement mobile (MonCash, NatCash ou KashPay, via l'agrégateur
// plopplop) pour une demande déjà créée (manuelle par défaut à la création —
// voir creerDemande) : crée la transaction côté plopplop et enregistre la
// référence de la tentative. Ne change PAS le statut du paiement (reste
// en_attente tant que plopplop n'a pas confirmé la transaction) — voir
// confirmerPaiementMobile pour la suite.
export async function demarrerPaiementMobile(paiement, methode) {
  if (!plopplopConfigure()) {
    return { ok: false, code: 503, erreur: "Le paiement mobile n'est pas configuré." };
  }
  if (!METHODES_VALIDES.includes(methode)) {
    return { ok: false, code: 400, erreur: 'Méthode de paiement invalide.' };
  }
  if (paiement.statut !== 'en_attente') {
    return { ok: false, code: 409, erreur: 'Ce paiement a déjà été traité.' };
  }
  if (paiement.devise !== 'HTG') {
    return { ok: false, code: 409, erreur: 'Le paiement mobile ne prend en charge que les paiements en HTG.' };
  }
  if (paiement.type_frais === 'inscription') {
    const ins = await trouverInscription(paiement.id_reference);
    if (ins?.statut === 'annulee') {
      return {
        ok: false, code: 409,
        erreur: 'Ce dossier a été annulé (délai de paiement dépassé). Veuillez soumettre un nouveau dossier.',
      };
    }
  }

  // plopplop (NatCash en particulier) rejette les montants décimaux (503
  // ERR_PARAMETERS_INVALID) et impose un minimum de 20 HTG — on arrondit au
  // gourde supérieure (jamais en défaveur de l'école) et on vérifie ce même
  // montant arrondi à la confirmation, pour que la comparaison reste cohérente.
  const montantEnvoye = Math.ceil(Number(paiement.montant));
  if (montantEnvoye < 20) {
    return { ok: false, code: 400, erreur: 'Le montant minimum pour un paiement mobile est de 20 HTG.' };
  }

  // Double-clic / deux onglets : un seul démarrage à la fois. Sans ce verrou,
  // deux transactions seraient créées et seule la dernière référence gardée —
  // un parent qui paierait la première ne serait jamais confirmé.
  if (!(await paiementModel.reserverDemarrage(paiement.id))) {
    return { ok: false, code: 409, erreur: 'Un paiement est déjà en cours de démarrage. Patientez quelques secondes.' };
  }

  const referenceId = `lk-${paiement.id}-${crypto.randomBytes(4).toString('hex')}`;
  let creation;
  try {
    creation = await creerPaiementPlopplop({ referenceId, montant: montantEnvoye, methode });
  } catch (err) {
    await paiementModel.libererDemarrage(paiement.id);
    return { ok: false, code: 502, erreur: `Paiement mobile indisponible : ${err.message}` };
  }

  await paiementModel.definirMethodeMobile(paiement.id, methode, referenceId);
  return { ok: true, urlRedirection: creation.url };
}

// Confirme un paiement mobile après le retour du parent sur le site (ou à la
// demande, en relance manuelle) : revérifie la transaction directement auprès
// de plopplop — jamais confiance à la seule redirection navigateur.
//
// SÉCURITÉ : on interroge TOUJOURS plopplop via paiement.reference_externe,
// la référence générée côté serveur pour CETTE demande précise — jamais via
// un identifiant fourni par le client. Un identifiant de transaction
// arbitraire (même issu d'un vrai paiement, même minime) ne doit jamais
// pouvoir être « rejoué » pour valider un paiement différent de celui pour
// lequel il a été émis : sans ce verrou, un paiement réel de faible montant
// suffirait à confirmer frauduleusement n'importe quelle autre demande en
// attente de même montant.
//
// Si le montant confirmé est inférieur au tarif en vigueur, le paiement N'EST
// PAS auto-validé : un paiement partiel reste possible (décision produit
// assumée pour le dépôt manuel), mais seule une validation manuelle par
// l'économat peut alors débloquer la confirmation d'inscription ou la
// génération de document — jamais l'automatisation, qui ne doit jamais
// délivrer le bénéfice complet contre un paiement incomplet.
export async function confirmerPaiementMobile({ paiement }) {
  if (!METHODES_VALIDES.includes(paiement.methode_paiement)) {
    return { ok: false, code: 409, erreur: 'Ce paiement ne passe pas par un moyen mobile.' };
  }
  if (paiement.statut !== 'en_attente') {
    // Déjà traité (double confirmation, rafraîchissement de la page…) : on
    // renvoie l'état actuel sans relancer les effets de bord.
    return { ok: true, statut: paiement.statut };
  }
  if (!paiement.reference_externe) {
    return { ok: false, code: 409, erreur: 'Aucun paiement mobile démarré pour cette demande.' };
  }

  let detail;
  try {
    detail = await verifierPaiementPlopplop(paiement.reference_externe);
  } catch (err) {
    return { ok: false, code: 502, erreur: `Vérification impossible : ${err.message}` };
  }

  if (!detail || detail.statut !== 'ok') {
    return { ok: false, code: 402, erreur: "Le paiement n'a pas abouti." };
  }

  const montantConfirme = Number(detail.montant);
  // Même arrondi qu'à la création (voir demarrerPaiementMobile) : plopplop ne
  // connaît que des gourdes entières, la comparaison doit se faire sur la même base.
  const montantDu = Math.ceil(Number(paiement.montant));
  if (montantConfirme !== montantDu) {
    alerter('paiement_montant_incoherent',
      `Montant confirmé par plopplop (${montantConfirme}) différent du montant dû (${montantDu})`,
      { sujet: `paiement #${paiement.id}` });
    return { ok: false, code: 409, erreur: 'Le montant confirmé ne correspond pas au paiement.' };
  }

  // Transaction déjà utilisée pour créditer un autre paiement ? (garde-fou
  // supplémentaire : la contrainte UNIQUE en base rejette de toute façon
  // l'écriture ci-dessous si c'est le cas — voir migration 030.)
  const dejaUtilise = await paiementModel.trouverParTransactionExterne(detail.transactionId);
  if (dejaUtilise && dejaUtilise.id !== paiement.id) {
    alerter('paiement_rejeu', `Transaction ${detail.transactionId} déjà utilisée pour le paiement #${dejaUtilise.id}`,
      { sujet: `paiement #${paiement.id}` });
    return { ok: false, code: 409, erreur: 'Cette transaction a déjà été utilisée pour un autre paiement.' };
  }

  await paiementModel.definirTransactionExterne(paiement.id, detail.transactionId);

  const tarif = await tarifCourant(paiement.type_frais);
  if (tarif && montantDu < Number(tarif.montant)) {
    return {
      ok: true, statut: 'en_attente', partiel: true,
      message: "Paiement reçu, mais inférieur au tarif en vigueur : en attente de validation par l'économat.",
    };
  }

  return traiterValidation({
    idPaiement: paiement.id,
    statut: 'valide',
    commentaire: `Payé via ${paiement.methode_paiement} (transaction ${detail.transactionId}).`,
    idAdmin: null,
  });
}

// Reconciliation périodique des paiements mobiles en attente — plopplop
// n'expose aucun webhook (confirmé dans sa documentation), donc rien ne
// prévient le serveur qu'un paiement a fini par aboutir si le parent ne
// revient jamais sur /paiements/retour (onglet fermé, page de publicité
// affichée après un paiement NatCash, coupure réseau…). Sans cette relance,
// un paiement réellement payé peut rester bloqué « en_attente » indéfiniment.
// Appelée en tâche de fond depuis server.js (toutes les ~2 minutes), en plus
// de la vérification déclenchée par le retour du parent ou une relance
// manuelle — les trois chemins appellent la même confirmerPaiementMobile,
// donc les mêmes garanties de sécurité (référence serveur, anti-rejeu,
// tarif) s'appliquent partout.
export async function reconcilierPaiementsMobilesEnAttente() {
  const enAttente = await paiementModel.listerMobilesEnAttente();
  let verifies = 0;
  let confirmes = 0;
  for (const paiement of enAttente) {
    try {
      const r = await confirmerPaiementMobile({ paiement });
      verifies += 1;
      if (r.ok && r.statut === 'valide') confirmes += 1;
    } catch (err) {
      console.error(`Reconciliation paiement #${paiement.id} échouée :`, err.message);
    }
  }
  if (verifies > 0) {
    console.log(`Reconciliation paiements mobiles : ${verifies} vérifiés, ${confirmes} confirmés.`);
  }
  return { verifies, confirmes };
}

// Annule les dossiers d'inscription dont les frais n'ont pas été payés dans le
// délai (DELAI_PAIEMENT_MINUTES) — appelée en tâche de fond depuis server.js.
// Un paiement démarré qui aboutit plus tard réactive le dossier (voir
// traiterValidation) : la reconciliation continue de le vérifier.
export async function annulerInscriptionsNonPayees() {
  const ids = await listerNonPayeesExpirees();
  let annulees = 0;
  for (const id of ids) {
    if (await annulerSiNonPayee(id)) {
      annulees += 1;
      await journaliser({
        entite: 'inscription', idEntite: id, ancienStatut: 'attente_paiement', nouveauStatut: 'annulee',
        commentaire: "Frais d'inscription non payés dans le délai", idAuteur: null,
      });
    }
  }
  return { annulees };
}
