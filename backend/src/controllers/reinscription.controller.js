// Contrôleur Ré-inscription
//   Parent  : état de campagne, liste des enfants ré-inscriptibles, ré-inscrire.
//   Propriétaire : lancer / clôturer la campagne + statut.
import { findParentIdByUserId } from '../models/user.model.js';
import { estAutorise, CLES } from '../services/permissions.service.js';
import { tarifCourant } from '../models/tarif.model.js';
import { plopplopConfigure } from '../config/plopplop.js';
import * as paiementModel from '../models/paiement.model.js';
import {
  transmettreApresPaiement, DELAI_PAIEMENT_MINUTES,
} from '../models/inscription.model.js';
import { journaliser } from '../models/historique.model.js';
import { anneeScolaireCourante, anneeSuivante } from '../utils/dates.js';
import { alerter } from '../services/securite.service.js';
import {
  campagneActive, derniereCampagne, enfantsAReinscrire, reinscrireEnfant,
  lancerCampagne, cloturerCampagne,
} from '../services/reinscription.service.js';

// GET /api/reinscription/etat (authentifié) — pour la bannière / le menu.
export async function etat(req, res, next) {
  try {
    const campagne = await campagneActive();
    res.json({ active: !!campagne, anneeCible: campagne ? campagne.annee_cible : null });
  } catch (err) {
    next(err);
  }
}

// GET /api/reinscription/mes-enfants (parent)
export async function mesEnfants(req, res, next) {
  try {
    const idParent = await findParentIdByUserId(req.session.userId);
    if (!idParent) return res.status(403).json({ erreur: 'Compte parent requis.' });
    res.json(await enfantsAReinscrire(idParent));
  } catch (err) {
    next(err);
  }
}

// POST /api/reinscription (parent) — ré-inscrit un enfant pour l'année visée.
export async function reinscrire(req, res, next) {
  try {
    const idParent = await findParentIdByUserId(req.session.userId);
    if (!idParent) return res.status(403).json({ erreur: 'Compte parent requis.' });
    const idEleve = Number(req.body?.idEleve);
    if (!idEleve) return res.status(400).json({ erreur: 'Élève requis.' });

    // Même règle de paiement que l'inscription normale (contrôle d'accès).
    const paiementRequis = await estAutorise(CLES.PAIEMENT_INSCRIPTION);
    let tarif = null;
    if (paiementRequis) {
      tarif = await tarifCourant('inscription');
      if (!tarif || tarif.devise !== 'HTG' || !plopplopConfigure()) {
        return res.status(503).json({
          erreur: "La ré-inscription en ligne est momentanément indisponible (paiement des frais non configuré). Contactez l'école.",
        });
      }
    }

    const r = await reinscrireEnfant(idParent, idEleve);
    if (!r.ok) return res.status(r.code).json({ erreur: r.erreur });

    if (paiementRequis) {
      // Dossier impayé réutilisé : on renvoie son paiement en cours s'il existe
      // encore, sinon on (re)crée un paiement pour ce dossier.
      let paiement = null;
      if (r.reutilise) {
        const p = await paiementModel.trouverPourInscription(r.idInscription);
        if (p && p.statut === 'en_attente') paiement = { id: p.id, montant: p.montant, devise: p.devise };
      }
      if (!paiement) {
        const idPaiement = await paiementModel.creer({
          typeFrais: 'inscription', idReference: r.idInscription, montant: tarif.montant, devise: tarif.devise,
        });
        paiement = { id: idPaiement, montant: tarif.montant, devise: tarif.devise };
      }
      return res.status(201).json({
        message: 'Ré-inscription créée — en attente du paiement des frais.',
        inscription: { id: r.idInscription, statut: 'attente_paiement', anneeCible: r.anneeCible, niveauDemande: r.niveauDemande },
        paiement,
        delaiPaiementMinutes: DELAI_PAIEMENT_MINUTES,
      });
    }

    // Paiement désactivé : dossier transmis directement au secrétariat.
    await transmettreApresPaiement(r.idInscription);
    await journaliser({
      entite: 'inscription', idEntite: r.idInscription, ancienStatut: 'attente_paiement',
      nouveauStatut: 'en_attente', commentaire: 'Ré-inscription (paiement désactivé)', idAuteur: null,
    });
    return res.status(201).json({
      message: 'Ré-inscription enregistrée.',
      inscription: { id: r.idInscription, statut: 'en_attente', anneeCible: r.anneeCible, niveauDemande: r.niveauDemande },
    });
  } catch (err) {
    next(err);
  }
}

// --- Propriétaire -------------------------------------------------------

// GET /api/proprietaire/reinscription — statut de la campagne.
export async function statutProprietaire(req, res, next) {
  try {
    const active = await campagneActive();
    const derniere = await derniereCampagne();
    res.json({
      active: !!active,
      campagne: derniere,
      prochaineAnneeCible: anneeSuivante(anneeScolaireCourante()),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/proprietaire/reinscription/lancer
export async function lancer(req, res, next) {
  try {
    const r = await lancerCampagne(req.session.userId);
    if (!r.ok) return res.status(r.code).json({ erreur: r.erreur });
    alerter('reinscription_lancee',
      `Campagne de ré-inscription lancée pour ${r.anneeCible} (${r.nbDestinataires} famille(s) notifiée(s)).`, { req });
    res.json(r);
  } catch (err) {
    next(err);
  }
}

// POST /api/proprietaire/reinscription/cloturer
export async function cloturer(req, res, next) {
  try {
    const r = await cloturerCampagne();
    if (!r.ok) return res.status(r.code).json({ erreur: r.erreur });
    alerter('reinscription_cloturee', 'Campagne de ré-inscription clôturée.', { req });
    res.json(r);
  } catch (err) {
    next(err);
  }
}
