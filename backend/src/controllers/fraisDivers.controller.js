// Contrôleur Frais divers — catalogue de frais (direction)
import * as fraisModel from '../models/fraisDivers.model.js';

const DEVISES = ['HTG', 'USD'];

function validerChamps({ nom, montant, devise }) {
  if (!nom) return 'Le nom du frais est requis.';
  if (!Number.isFinite(montant) || montant <= 0) return 'Montant invalide (> 0).';
  if (!DEVISES.includes(devise)) return 'Devise invalide (HTG, USD).';
  return null;
}

// GET /api/frais-divers (connecté)
export async function lister(req, res, next) {
  try {
    return res.json({ frais: await fraisModel.lister() });
  } catch (err) {
    next(err);
  }
}

// POST /api/frais-divers (direction)
export async function creer(req, res, next) {
  try {
    const nom = (req.body.nom || '').trim();
    const niveau = (req.body.niveau || '').trim();
    const anneeScolaire = (req.body.anneeScolaire || '').trim();
    const montant = Number(req.body.montant);
    const devise = (req.body.devise || 'HTG').trim();
    const unite = (req.body.unite || '').trim();

    const erreur = validerChamps({ nom, montant, devise });
    if (erreur) return res.status(400).json({ erreur });

    const id = await fraisModel.creer({ nom, niveau, anneeScolaire, montant, devise, unite });
    return res.status(201).json({
      frais: { id, nom, niveau: niveau || null, anneeScolaire: anneeScolaire || null, montant, devise, unite: unite || null },
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/frais-divers/:id (direction)
export async function mettreAJour(req, res, next) {
  try {
    const existant = await fraisModel.trouverParId(Number(req.params.id));
    if (!existant) return res.status(404).json({ erreur: 'Frais introuvable.' });

    const patch = {};
    if (req.body.nom !== undefined) {
      const nom = (req.body.nom || '').trim();
      if (!nom) return res.status(400).json({ erreur: 'Le nom du frais est requis.' });
      patch.nom = nom;
    }
    if (req.body.niveau !== undefined) patch.niveau = (req.body.niveau || '').trim();
    if (req.body.anneeScolaire !== undefined) patch.anneeScolaire = (req.body.anneeScolaire || '').trim();
    if (req.body.montant !== undefined) {
      const m = Number(req.body.montant);
      if (!Number.isFinite(m) || m <= 0) return res.status(400).json({ erreur: 'Montant invalide (> 0).' });
      patch.montant = m;
    }
    if (req.body.devise !== undefined) {
      if (!DEVISES.includes(req.body.devise)) return res.status(400).json({ erreur: 'Devise invalide (HTG, USD).' });
      patch.devise = req.body.devise;
    }
    if (req.body.unite !== undefined) patch.unite = (req.body.unite || '').trim();

    await fraisModel.mettreAJour(existant.id, patch);
    return res.json({ message: 'Frais mis à jour.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/frais-divers/:id (direction)
export async function supprimer(req, res, next) {
  try {
    const existant = await fraisModel.trouverParId(Number(req.params.id));
    if (!existant) return res.status(404).json({ erreur: 'Frais introuvable.' });
    await fraisModel.supprimer(existant.id);
    return res.json({ message: 'Frais supprimé.' });
  } catch (err) {
    next(err);
  }
}
