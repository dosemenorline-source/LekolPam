// Contrôleur Paiements
import path from 'path';
import * as paiementModel from '../models/paiement.model.js';
import { findParentIdByUserId } from '../models/user.model.js';
import {
  creerDemande, traiterValidation, proprietaireDe, demarrerPaiementMobile, confirmerPaiementMobile,
} from '../services/paiement.service.js';
import { tarifCourant } from '../models/tarif.model.js';
import { UPLOAD_ROOT } from '../config/upload.js';
import { trouverParId as trouverEconomatAdminParId } from '../models/economatAdmin.model.js';
import { trouverAvecProprietaire as trouverInscription, STATUTS_NON_PAYES }
  from '../models/inscription.model.js';

// Vue d'un paiement pour le parent : uniquement les champs utiles à l'écran —
// jamais les références techniques (transaction plopplop, référence externe,
// verrou de démarrage) ni l'identifiant de la personne qui a validé.
const CHAMPS_PARENT = [
  'id', 'type_frais', 'id_reference', 'montant', 'devise', 'statut', 'methode_paiement',
  'preuve_url', 'cree_le', 'valide_le', 'inscription_statut',
];
function vueParent(p) {
  return Object.fromEntries(CHAMPS_PARENT.filter((c) => c in p).map((c) => [c, p[c]]));
}

// Statut du dossier d'inscription lié à des frais d'inscription (sinon null)
async function statutInscriptionDe(paiement) {
  if (paiement.type_frais !== 'inscription') return null;
  return (await trouverInscription(paiement.id_reference))?.statut || null;
}

// Types de frais à tarif fixe (voir services/paiement.service.js) — le montant
// saisi par le parent est le montant réellement déposé (peut différer du tarif
// en cas de paiement partiel), mais l'admin doit voir l'écart pour le repérer
// facilement pendant la validation.
const TYPES_TARIF_FIXE = ['inscription', 'releve', 'duplicata'];

// Accès complet (tout paiement, pas seulement le sien) réservé à l'admin
// Économat — module détaché des rôles admin/direction.
function estAdminEconomat(req) {
  return !!(req.session && req.session.economatAdminId);
}

// POST /api/paiements (parent)
export async function creer(req, res, next) {
  try {
    const typeFrais = (req.body.typeFrais || '').trim();
    const idReference = Number(req.body.idReference);
    const montant = Number(req.body.montant);
    const r = await creerDemande({ typeFrais, idReference, montant, idUtilisateur: req.session.userId });
    if (!r.ok) return res.status(r.code).json({ erreur: r.erreur });
    return res.status(201).json({ paiement: r.paiement, coordonnees: r.coordonnees });
  } catch (err) {
    next(err);
  }
}

// POST /api/paiements/:id/preuve (parent propriétaire)
export async function televerserPreuve(req, res, next) {
  try {
    const paiement = await paiementModel.trouverParId(Number(req.params.id));
    if (!paiement) return res.status(404).json({ erreur: 'Paiement introuvable.' });

    const idProprietaire = await proprietaireDe(paiement);
    if (idProprietaire !== req.session.userId) return res.status(403).json({ erreur: 'Accès refusé.' });

    if (!req.file) return res.status(400).json({ erreur: 'Preuve requise (PDF/JPG/PNG, max 5 Mo).' });
    // Frais payés à la soumission du dossier : en ligne uniquement
    if (STATUTS_NON_PAYES.includes(await statutInscriptionDe(paiement))) {
      return res.status(409).json({ erreur: "Les frais d'inscription se paient en ligne uniquement." });
    }

    await paiementModel.definirPreuve(paiement.id, `preuves/${req.file.filename}`);
    return res.status(201).json({ message: 'Preuve téléversée.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/paiements/:id/paiement-mobile/demarrer (parent propriétaire)
export async function demarrerMobile(req, res, next) {
  try {
    const paiement = await paiementModel.trouverParId(Number(req.params.id));
    if (!paiement) return res.status(404).json({ erreur: 'Paiement introuvable.' });

    const idProprietaire = await proprietaireDe(paiement);
    if (idProprietaire !== req.session.userId) return res.status(403).json({ erreur: 'Accès refusé.' });

    const methode = (req.body.methode || '').trim();
    const r = await demarrerPaiementMobile(paiement, methode);
    if (!r.ok) return res.status(r.code).json({ erreur: r.erreur });
    return res.json({ urlRedirection: r.urlRedirection });
  } catch (err) {
    next(err);
  }
}

// POST /api/paiements/:id/paiement-mobile/confirmer (parent propriétaire —
// appelé au retour depuis plopplop, ou manuellement si le retour automatique
// échoue). Le corps de la requête n'est jamais utilisé pour la vérification :
// voir confirmerPaiementMobile — seul paiement.reference_externe (généré côté
// serveur) sert à interroger plopplop, jamais un identifiant fourni par le
// client (un identifiant de transaction arbitraire ne doit jamais pouvoir
// être rejoué pour créditer un paiement différent de celui pour lequel il a
// été émis).
export async function confirmerMobile(req, res, next) {
  try {
    const paiement = await paiementModel.trouverParId(Number(req.params.id));
    if (!paiement) return res.status(404).json({ erreur: 'Paiement introuvable.' });

    const idProprietaire = await proprietaireDe(paiement);
    if (idProprietaire !== req.session.userId) return res.status(403).json({ erreur: 'Accès refusé.' });

    const r = await confirmerPaiementMobile({ paiement });
    if (!r.ok) return res.status(r.code).json({ erreur: r.erreur });
    return res.json({ message: r.message || 'Paiement confirmé.', statut: r.statut, partiel: !!r.partiel });
  } catch (err) {
    next(err);
  }
}

// POST /api/paiements/webhook/plopplop (public — appelé par le serveur
// plopplop, pas par un navigateur, donc sans session). plopplop signale
// qu'une transaction a changé d'état ; on ne fait JAMAIS confiance au contenu
// de la notification elle-même (payload potentiellement falsifiable, et le
// format exact des événements transaction.created / transaction.status_changed
// n'est pas documenté avec certitude) — elle sert uniquement de déclencheur
// pour revérifier IMMÉDIATEMENT auprès de plopplop via confirmerPaiementMobile,
// le même chemin que le retour du parent et la reconciliation périodique
// (server.js), qui reste la seule source de vérité. Un identifiant de
// référence inconnu ou une notification sans référence exploitable est
// silencieusement ignorée (toujours 200, pour éviter que plopplop ne
// retente en boucle).
export async function webhookPlopplop(req, res, next) {
  try {
    const corps = req.body || {};
    const referenceExterne =
      corps.refference_id || corps.reference_id
      || corps?.data?.refference_id || corps?.data?.reference_id
      || corps?.transaction?.refference_id || corps?.transaction?.reference_id
      || null;

    if (!referenceExterne) {
      console.warn('Webhook plopplop reçu sans référence exploitable :', JSON.stringify(corps).slice(0, 500));
      return res.status(200).json({ recu: true });
    }

    const paiement = await paiementModel.trouverParReferenceExterne(referenceExterne);
    if (!paiement) {
      return res.status(200).json({ recu: true });
    }

    // Ne bloque jamais la réponse HTTP sur la vérification serveur-à-serveur
    // auprès de plopplop : on répond vite, comme la reconciliation périodique.
    confirmerPaiementMobile({ paiement }).catch((err) => {
      console.error(`Webhook plopplop : confirmation paiement #${paiement.id} échouée :`, err.message);
    });

    return res.status(200).json({ recu: true });
  } catch (err) {
    next(err);
  }
}

// GET /api/paiements (parent — les siens)
export async function listerMiens(req, res, next) {
  try {
    const idParent = await findParentIdByUserId(req.session.userId);
    if (!idParent) return res.status(403).json({ erreur: 'Compte parent requis.' });
    return res.json({ paiements: (await paiementModel.listerParParent(idParent)).map(vueParent) });
  } catch (err) {
    next(err);
  }
}

// Charge un paiement + vérifie l'accès (propriétaire ou admin)
async function chargerAutorise(req, res) {
  const paiement = await paiementModel.trouverParId(Number(req.params.id));
  if (!paiement) { res.status(404).json({ erreur: 'Paiement introuvable.' }); return null; }
  if (!estAdminEconomat(req)) {
    const idProprietaire = await proprietaireDe(paiement);
    if (idProprietaire !== req.session.userId) { res.status(403).json({ erreur: 'Accès refusé.' }); return null; }
  }
  return paiement;
}

// GET /api/paiements/:id (propriétaire ou admin)
export async function detail(req, res, next) {
  try {
    const paiement = await chargerAutorise(req, res);
    if (!paiement) return;
    const complet = { ...paiement, inscription_statut: await statutInscriptionDe(paiement) };
    return res.json({ paiement: estAdminEconomat(req) ? complet : vueParent(complet) });
  } catch (err) {
    next(err);
  }
}

// GET /api/paiements/:id/preuve (propriétaire ou admin)
export async function servirPreuve(req, res, next) {
  try {
    const paiement = await chargerAutorise(req, res);
    if (!paiement) return;
    if (!paiement.preuve_url) return res.status(404).json({ erreur: 'Aucune preuve.' });
    const chemin = path.resolve(UPLOAD_ROOT, paiement.preuve_url);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) return res.status(400).json({ erreur: 'Chemin invalide.' });
    return res.sendFile(chemin);
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/paiements?statut= (admin/direction)
export async function listerAdmin(req, res, next) {
  try {
    const paiements = await paiementModel.listerAdmin(req.query.statut);

    const tarifsParType = {};
    for (const type of TYPES_TARIF_FIXE) {
      const t = await tarifCourant(type);
      if (t) tarifsParType[type] = Number(t.montant);
    }

    const enrichis = paiements.map((p) => {
      const tarifActuel = tarifsParType[p.type_frais];
      return {
        ...p,
        tarif_actuel: tarifActuel ?? null,
        montant_suspect: tarifActuel != null && Number(p.montant) !== tarifActuel,
      };
    });

    return res.json({ paiements: enrichis });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/paiements/:id/validation (admin/direction)
export async function validation(req, res, next) {
  try {
    const statut = (req.body.statut || '').trim();
    const commentaire = req.body.commentaire ? String(req.body.commentaire).trim() : null;

    // Le compte Économat est un système d'authentification indépendant (voir
    // requireEconomatAdmin, middleware/auth.js) : son identifiant ne correspond
    // à aucune ligne de la table utilisateurs, donc il ne peut jamais être
    // stocké dans valide_par (clé étrangère vers utilisateurs — l'y mettre
    // pointerait vers un compte école sans rapport, ou romprait la contrainte).
    // On trace plutôt son identité dans noteAuteur, qui ne rejoint QUE
    // l'historique interne (jamais commentaire, qui part aussi dans la
    // notification envoyée au parent — y mettre un e-mail de l'équipe y
    // fuiterait).
    let idAdmin = req.session.userId || null;
    let noteAuteur = null;
    if (!idAdmin && req.session.economatAdminId) {
      const admin = await trouverEconomatAdminParId(req.session.economatAdminId);
      if (admin) noteAuteur = `[Économat : ${admin.email}]`;
    }

    const r = await traiterValidation({
      idPaiement: Number(req.params.id), statut, commentaire, idAdmin, noteAuteur,
    });
    if (!r.ok) return res.status(r.code).json({ erreur: r.erreur });
    return res.json({
      message: 'Paiement traité.',
      statut: r.statut,
      ...(r.document ? { document: r.document } : {}),
      ...(r.previewUrl ? { apercuCourriel: r.previewUrl } : {}),
    });
  } catch (err) {
    next(err);
  }
}
