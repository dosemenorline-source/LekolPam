// Contrôleur Matières
import * as matiereModel from '../models/matiere.model.js';

// Le coefficient est stocké en decimal(4,2) : valeur maximale = 99.99.
const COEF_MAX = 99.99;

// POST /api/matieres (direction)
export async function creer(req, res, next) {
  try {
    const nom = (req.body.nom || '').trim();
    const niveau = (req.body.niveau || '').trim();
    const coefficient = Number(req.body.coefficient);

    if (!nom || !niveau) {
      return res.status(400).json({ erreur: 'Nom et niveau requis.' });
    }
    if (!Number.isFinite(coefficient) || coefficient <= 0 || coefficient > COEF_MAX) {
      return res.status(400).json({ erreur: `Coefficient invalide (doit être entre 0 et ${COEF_MAX}).` });
    }

    try {
      const id = await matiereModel.creer({ nom, niveau, coefficient });
      return res.status(201).json({ matiere: { id, nom, niveau, coefficient } });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ erreur: 'Cette matière existe déjà pour ce niveau.' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

// GET /api/matieres?niveau= (admin/direction)
export async function lister(req, res, next) {
  try {
    const matieres = await matiereModel.lister(req.query.niveau);
    return res.json({ matieres });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/matieres/:id (direction)
export async function mettreAJour(req, res, next) {
  try {
    const existante = await matiereModel.trouverParId(Number(req.params.id));
    if (!existante) return res.status(404).json({ erreur: 'Matière introuvable.' });

    const patch = {};
    if (req.body.nom !== undefined) {
      const nom = String(req.body.nom).trim();
      if (!nom) return res.status(400).json({ erreur: 'Nom requis.' });
      patch.nom = nom;
    }
    if (req.body.niveau !== undefined) {
      const niveau = String(req.body.niveau).trim();
      if (!niveau) return res.status(400).json({ erreur: 'Niveau requis.' });
      patch.niveau = niveau;
    }
    if (req.body.coefficient !== undefined) {
      const c = Number(req.body.coefficient);
      if (!Number.isFinite(c) || c <= 0 || c > COEF_MAX) {
        return res.status(400).json({ erreur: `Coefficient invalide (doit être entre 0 et ${COEF_MAX}).` });
      }
      patch.coefficient = c;
    }
    if (req.body.actif !== undefined) patch.actif = !!req.body.actif;

    try {
      await matiereModel.mettreAJour(existante.id, patch);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ erreur: 'Cette matière existe déjà pour ce niveau.' });
      }
      throw err;
    }
    return res.json({ message: 'Matière mise à jour.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/matieres/:id (direction)
export async function supprimer(req, res, next) {
  try {
    const supprimee = await matiereModel.supprimer(Number(req.params.id));
    if (!supprimee) return res.status(404).json({ erreur: 'Matière introuvable.' });
    return res.json({ message: 'Matière supprimée.' });
  } catch (err) {
    next(err);
  }
}
