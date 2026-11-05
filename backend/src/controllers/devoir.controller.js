// Contrôleur Devoir — soumis par un professeur pour une de ses matières (classes).
import * as devoirModel from '../models/devoir.model.js';
import { enseigneMatiere } from '../models/enseignant.model.js';
import { trouverParId as trouverEleveParId } from '../models/eleve.model.js';

// POST /api/professeur/devoirs (professeur)
export async function creer(req, res, next) {
  try {
    const idMatiere = Number(req.body.idMatiere);
    const titre = (req.body.titre || '').trim();
    const description = (req.body.description || '').trim();
    const dateLimite = req.body.dateLimite || null;

    if (!Number.isInteger(idMatiere) || idMatiere <= 0) {
      return res.status(400).json({ erreur: 'idMatiere invalide.' });
    }
    if (!titre) return res.status(400).json({ erreur: 'Titre requis.' });
    if (dateLimite && !/^\d{4}-\d{2}-\d{2}$/.test(dateLimite)) {
      return res.status(400).json({ erreur: 'Date limite invalide.' });
    }

    // Un professeur ne peut poster un devoir que pour une classe qu'il enseigne.
    const autorise = await enseigneMatiere(req.session.userId, idMatiere);
    if (!autorise) return res.status(403).json({ erreur: "Vous n'enseignez pas cette classe." });

    const id = await devoirModel.creer({
      idMatiere, idEnseignant: req.session.userId, titre, description, dateLimite,
    });
    return res.status(201).json({ message: 'Devoir publié.', id });
  } catch (err) {
    next(err);
  }
}

// GET /api/professeur/devoirs?idMatiere= (professeur) — ses propres devoirs
export async function listerPourEnseignant(req, res, next) {
  try {
    const idMatiere = req.query.idMatiere ? Number(req.query.idMatiere) : null;
    const devoirs = await devoirModel.listerPourEnseignant(req.session.userId, idMatiere);
    return res.json({ devoirs });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/professeur/devoirs/:id (professeur, ses propres devoirs seulement)
export async function supprimer(req, res, next) {
  try {
    const ok = await devoirModel.supprimer(Number(req.params.id), req.session.userId);
    if (!ok) return res.status(404).json({ erreur: 'Devoir introuvable.' });
    return res.json({ message: 'Devoir supprimé.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/eleve/devoirs (élève) — devoirs des matières de son niveau
export async function listerPourEleve(req, res, next) {
  try {
    const eleve = await trouverEleveParId(req.session.eleveId);
    if (!eleve || !eleve.niveau) return res.json({ devoirs: [] });
    const devoirs = await devoirModel.listerPourNiveau(eleve.niveau);
    return res.json({ devoirs });
  } catch (err) {
    next(err);
  }
}
