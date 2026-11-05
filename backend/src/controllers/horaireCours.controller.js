// Contrôleur Horaire de cours — créneaux soumis par un professeur pour une de
// ses matières (classes).
import * as horaireModel from '../models/horaireCours.model.js';
import { enseigneMatiere } from '../models/enseignant.model.js';
import { trouverParId as trouverEleveParId } from '../models/eleve.model.js';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const HEURE_REGEX = /^\d{2}:\d{2}$/;

function validerCreneau({ jourSemaine, heureDebut, heureFin }) {
  if (!JOURS.includes(jourSemaine)) return 'Jour invalide.';
  if (!HEURE_REGEX.test(heureDebut) || !HEURE_REGEX.test(heureFin)) return 'Heure invalide.';
  if (heureDebut >= heureFin) return "L'heure de fin doit être après l'heure de début.";
  return null;
}

// POST /api/professeur/horaires (professeur)
export async function creer(req, res, next) {
  try {
    const idMatiere = Number(req.body.idMatiere);
    const { jourSemaine, heureDebut, heureFin } = req.body;
    const salle = (req.body.salle || '').trim();

    if (!Number.isInteger(idMatiere) || idMatiere <= 0) {
      return res.status(400).json({ erreur: 'idMatiere invalide.' });
    }
    const erreur = validerCreneau({ jourSemaine, heureDebut, heureFin });
    if (erreur) return res.status(400).json({ erreur });

    const autorise = await enseigneMatiere(req.session.userId, idMatiere);
    if (!autorise) return res.status(403).json({ erreur: "Vous n'enseignez pas cette classe." });

    const id = await horaireModel.creer({
      idMatiere, idEnseignant: req.session.userId, jourSemaine, heureDebut, heureFin, salle,
    });
    return res.status(201).json({ message: 'Créneau ajouté.', id });
  } catch (err) {
    next(err);
  }
}

// GET /api/professeur/horaires?idMatiere= (professeur) — ses propres créneaux
export async function listerPourEnseignant(req, res, next) {
  try {
    const idMatiere = req.query.idMatiere ? Number(req.query.idMatiere) : null;
    const horaires = await horaireModel.listerPourEnseignant(req.session.userId, idMatiere);
    return res.json({ horaires });
  } catch (err) {
    next(err);
  }
}

// PUT /api/professeur/horaires/:id (professeur, ses propres créneaux seulement)
export async function mettreAJour(req, res, next) {
  try {
    const { jourSemaine, heureDebut, heureFin } = req.body;
    const salle = (req.body.salle || '').trim();
    const erreur = validerCreneau({ jourSemaine, heureDebut, heureFin });
    if (erreur) return res.status(400).json({ erreur });

    const ok = await horaireModel.mettreAJour(Number(req.params.id), req.session.userId, {
      jourSemaine, heureDebut, heureFin, salle,
    });
    if (!ok) return res.status(404).json({ erreur: 'Créneau introuvable.' });
    return res.json({ message: 'Créneau mis à jour.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/professeur/horaires/:id (professeur, ses propres créneaux seulement)
export async function supprimer(req, res, next) {
  try {
    const ok = await horaireModel.supprimer(Number(req.params.id), req.session.userId);
    if (!ok) return res.status(404).json({ erreur: 'Créneau introuvable.' });
    return res.json({ message: 'Créneau supprimé.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/eleve/horaire (élève) — horaire complet des matières de son niveau
export async function listerPourEleve(req, res, next) {
  try {
    const eleve = await trouverEleveParId(req.session.eleveId);
    if (!eleve || !eleve.niveau) return res.json({ horaires: [] });
    const horaires = await horaireModel.listerPourNiveau(eleve.niveau);
    return res.json({ horaires });
  } catch (err) {
    next(err);
  }
}
