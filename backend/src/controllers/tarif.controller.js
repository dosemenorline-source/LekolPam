// Contrôleur Tarifs + École
import path from 'path';
import fs from 'fs/promises';
import * as tarifModel from '../models/tarif.model.js';
import * as ecoleModel from '../models/ecole.model.js';
import * as eleveModel from '../models/eleve.model.js';
import { UPLOAD_ROOT } from '../config/upload.js';
import { tracer } from '../services/securite.service.js';
import { estAutorise, CLES } from '../services/permissions.service.js';

const TYPES = ['inscription', 'releve', 'duplicata'];
const DEVISES = ['HTG', 'USD'];

// Un seul tarif valable par type : les tarifs remplacés sont supprimés
async function purgerTarifsRemplaces() {
  for (const type of TYPES) await tarifModel.purgerRemplaces(type);
}

// GET /api/economat/niveaux (admin Économat) — liste des niveaux connus,
// sans exposer les dossiers élèves (contrairement à /admin/eleves-codes).
export async function niveaux(req, res, next) {
  try {
    const niveaux = await eleveModel.listerNiveauxConnus();
    return res.json({ niveaux });
  } catch (err) {
    next(err);
  }
}

// POST /api/tarifs (direction)
export async function creerTarif(req, res, next) {
  try {
    const typeFrais = (req.body.typeFrais || '').trim();
    const montant = Number(req.body.montant);
    const devise = (req.body.devise || 'HTG').trim();
    const dateEffective = (req.body.dateEffective || '').trim();

    if (!TYPES.includes(typeFrais)) return res.status(400).json({ erreur: `Type de frais invalide (${TYPES.join(', ')}).` });
    if (!Number.isFinite(montant) || montant <= 0) return res.status(400).json({ erreur: 'Montant invalide (> 0).' });
    if (!DEVISES.includes(devise)) return res.status(400).json({ erreur: 'Devise invalide (HTG, USD).' });
    if (!dateEffective) return res.status(400).json({ erreur: 'dateEffective requise (AAAA-MM-JJ).' });

    const id = await tarifModel.creer({ typeFrais, montant, devise, dateEffective });
    await purgerTarifsRemplaces();
    return res.status(201).json({ tarif: { id, typeFrais, montant, devise, dateEffective } });
  } catch (err) {
    next(err);
  }
}

// GET /api/tarifs (connecté)
export async function listerTarifs(req, res, next) {
  try {
    await purgerTarifsRemplaces();
    return res.json({ tarifs: await tarifModel.lister() });
  } catch (err) {
    next(err);
  }
}

// PUT /api/tarifs/:id (direction)
export async function mettreAJourTarif(req, res, next) {
  try {
    const existant = await tarifModel.trouverParId(Number(req.params.id));
    if (!existant) return res.status(404).json({ erreur: 'Tarif introuvable.' });

    const patch = {};
    if (req.body.montant !== undefined) {
      const m = Number(req.body.montant);
      if (!Number.isFinite(m) || m <= 0) return res.status(400).json({ erreur: 'Montant invalide.' });
      patch.montant = m;
    }
    if (req.body.devise !== undefined) {
      if (!DEVISES.includes(req.body.devise)) return res.status(400).json({ erreur: 'Devise invalide.' });
      patch.devise = req.body.devise;
    }
    if (req.body.dateEffective !== undefined) patch.dateEffective = req.body.dateEffective;

    await tarifModel.mettreAJour(existant.id, patch);
    await purgerTarifsRemplaces();
    return res.json({ message: 'Tarif mis à jour.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/tarifs/:id (admin Économat) — les paiements gardent leur
// propre montant : supprimer un tarif ne modifie aucun paiement existant.
export async function supprimerTarif(req, res, next) {
  try {
    const existant = await tarifModel.trouverParId(Number(req.params.id));
    if (!existant) return res.status(404).json({ erreur: 'Tarif introuvable.' });
    await tarifModel.supprimer(existant.id);
    tracer('tarif_supprime', {
      req, sujet: existant.type_frais,
      details: `${existant.montant} ${existant.devise} (économat #${req.session.economatAdminId})`,
    });
    return res.json({ message: 'Tarif supprimé.' });
  } catch (err) {
    next(err);
  }
}

// PUT /api/ecole (direction)
export async function definirEcole(req, res, next) {
  try {
    const nom = (req.body.nom || '').trim();
    if (!nom) return res.status(400).json({ erreur: "Le nom de l'école est requis." });
    await ecoleModel.definir({
      nom,
      coordonneesBancaires: req.body.coordonneesBancaires,
      coordonneesMoncash: req.body.coordonneesMoncash,
      adresse: req.body.adresse,
      telephone: req.body.telephone,
      courriel: req.body.courriel,
    });
    return res.json({ message: 'École enregistrée.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/ecole/coordonnees (connecté)
export async function coordonneesEcole(req, res, next) {
  try {
    const ecole = await ecoleModel.obtenir();
    return res.json({
      nom: ecole?.nom || 'Lekòl Pam',
      coordonneesBancaires: ecole?.coordonnees_bancaires || null,
      coordonneesMoncash: ecole?.coordonnees_moncash || null,
      adresse: ecole?.adresse || null,
      telephone: ecole?.telephone || null,
      courriel: ecole?.courriel || null,
      aLogo: !!(ecole && ecole.logo_url),
      seuilReussite: ecole ? Number(ecole.seuil_reussite) : 60,
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/ecole-seuil-reussite (admin, direction) — note de passage /100
export async function majSeuilReussite(req, res, next) {
  try {
    const seuil = Number(req.body.seuil);
    if (!Number.isFinite(seuil) || seuil < 0 || seuil > 100) {
      return res.status(400).json({ erreur: 'Le seuil doit être un nombre entre 0 et 100.' });
    }
    await ecoleModel.mettreSeuilReussite(seuil);
    return res.json({ seuilReussite: seuil });
  } catch (err) {
    next(err);
  }
}

// GET /api/ecole/marque (public) — identité de marque affichée dans l'en-tête
// (nom + présence d'un logo). Accessible sans authentification pour le site public.
export async function marqueEcole(req, res, next) {
  try {
    const ecole = await ecoleModel.obtenir();
    return res.json({
      nom: ecole?.nom || 'Lekòl Pam',
      aLogo: !!(ecole && ecole.logo_url),
      // Public (pas sensible) : les comptes élève (session par code, sans req.session.userId)
      // n'ont pas accès à /ecole/coordonnees (requireAuth) — c'est ici qu'ils le lisent.
      seuilReussite: ecole ? Number(ecole.seuil_reussite) : 60,
      // Auto-inscription des élèves autorisée par le propriétaire ? (public : la
      // page de connexion affiche ou non l'option « élève : créer un compte »)
      inscriptionEleve: await estAutorise(CLES.INSCRIPTION_ELEVE),
      // Inscription des parents autorisée par le propriétaire ? (public : la page
      // « Créer un compte parent » est ouverte ou fermée selon cette valeur)
      inscriptionParent: await estAutorise(CLES.INSCRIPTION_PARENT),
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/ecole-entete (admin/direction) — en-tête du badge (nom, adresse, tél, courriel)
export async function majEnteteEcole(req, res, next) {
  try {
    const nom = (req.body.nom || '').trim();
    if (!nom) return res.status(400).json({ erreur: "Le nom de l'école est requis." });
    const adresse = (req.body.adresse || '').trim();
    const telephone = (req.body.telephone || '').trim();
    const courriel = (req.body.courriel || '').trim();
    await ecoleModel.mettreEntete({ nom, adresse, telephone, courriel });
    return res.json({
      nom,
      adresse: adresse || null,
      telephone: telephone || null,
      courriel: courriel || null,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/ecole/logo (direction, multipart) — téléverse le logo de l'école
export async function televerserLogo(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ erreur: 'Logo requis (JPG ou PNG, max 5 Mo).' });
    await ecoleModel.mettreLogo(`logos/${req.file.filename}`);
    return res.status(201).json({ message: 'Logo enregistré.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/ecole/logo (direction) — supprime le logo de l'école
export async function supprimerLogo(req, res, next) {
  try {
    const ecole = await ecoleModel.obtenir();
    if (!ecole || !ecole.logo_url) return res.status(404).json({ erreur: 'Aucun logo à supprimer.' });

    // Supprime le fichier physique (au mieux : on n'échoue pas si absent)
    const chemin = path.resolve(UPLOAD_ROOT, ecole.logo_url);
    if (chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      await fs.unlink(chemin).catch(() => {});
    }
    await ecoleModel.mettreLogo(null);
    return res.json({ message: 'Logo supprimé.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/ecole/logo — sert le logo de l'école (accessible à tous, y compris élève)
export async function servirLogo(req, res, next) {
  try {
    const ecole = await ecoleModel.obtenir();
    if (!ecole || !ecole.logo_url) return res.status(404).json({ erreur: 'Aucun logo.' });
    const chemin = path.resolve(UPLOAD_ROOT, ecole.logo_url);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      return res.status(400).json({ erreur: 'Chemin invalide.' });
    }
    return res.sendFile(chemin);
  } catch (err) {
    next(err);
  }
}
