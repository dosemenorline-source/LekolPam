// Contrôleur Enseignant — gestion des comptes professeur (direction) et
// consultation de ses propres matières (professeur, self-service).
import { findByCourriel } from '../models/user.model.js';
import * as enseignantModel from '../models/enseignant.model.js';
import { trouverParId as trouverMatiereParId } from '../models/matiere.model.js';
import { envoyerLienCreationMotDePasse } from '../services/otp.service.js';
import { courrielConfigure } from '../config/mailer.js';

const COURRIEL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/direction/enseignants (direction) — liste des comptes professeur
export async function lister(req, res, next) {
  try {
    const enseignants = await enseignantModel.lister();
    return res.json({ enseignants });
  } catch (err) {
    next(err);
  }
}

// POST /api/direction/enseignants (direction) — crée un compte professeur
// sans mot de passe : un lien lui est envoyé par courriel pour qu'il en
// choisisse un lui-même (la direction ne le définit jamais à sa place).
export async function creer(req, res, next) {
  try {
    const nom = (req.body.nom || '').trim();
    const courriel = (req.body.courriel || '').trim().toLowerCase();

    if (!nom || !courriel) {
      return res.status(400).json({ erreur: 'Nom et courriel sont requis.' });
    }
    if (!COURRIEL_REGEX.test(courriel)) {
      return res.status(400).json({ erreur: 'Courriel invalide.' });
    }
    if (!courrielConfigure()) {
      return res.status(503).json({
        erreur: "L'envoi de courriel n'est pas configuré sur le serveur : impossible d'inviter un professeur "
          + 'à créer son mot de passe.',
      });
    }

    const existant = await findByCourriel(courriel);
    if (existant) {
      return res.status(409).json({ erreur: 'Ce courriel est déjà utilisé.' });
    }

    const enseignant = await enseignantModel.creer({ nom, courriel, motDePasseHash: null });

    try {
      await envoyerLienCreationMotDePasse({ idUtilisateur: enseignant.id, courriel, nom });
    } catch (err) {
      console.error(`✖ Envoi du lien de création à ${courriel} échoué :`, err.message);
      return res.status(201).json({
        message: "Compte créé, mais l'envoi du courriel a échoué. Utilisez « Mot de passe oublié » pour lui renvoyer un lien.",
        enseignant,
      });
    }

    return res.status(201).json({ message: 'Compte professeur créé. Un lien lui a été envoyé par courriel.', enseignant });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/direction/enseignants/:id (direction) — active/désactive un compte
export async function definirStatut(req, res, next) {
  try {
    const id = Number(req.params.id);
    const statut = req.body.statut;
    if (statut !== 'actif' && statut !== 'inactif') {
      return res.status(400).json({ erreur: 'Statut invalide.' });
    }
    const enseignant = await enseignantModel.trouverParId(id);
    if (!enseignant) return res.status(404).json({ erreur: 'Professeur introuvable.' });

    await enseignantModel.definirStatut(id, statut);
    return res.json({ message: 'Statut mis à jour.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/direction/enseignants/:id/matieres (direction) — assigne une classe
export async function assignerMatiere(req, res, next) {
  try {
    const id = Number(req.params.id);
    const idMatiere = Number(req.body.idMatiere);
    const enseignant = await enseignantModel.trouverParId(id);
    if (!enseignant) return res.status(404).json({ erreur: 'Professeur introuvable.' });
    const matiere = await trouverMatiereParId(idMatiere);
    if (!matiere) return res.status(404).json({ erreur: 'Matière introuvable.' });

    await enseignantModel.assignerMatiere(id, idMatiere);
    return res.status(201).json({ message: 'Classe assignée.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/direction/enseignants/:id/matieres/:idMatiere (direction)
export async function retirerMatiere(req, res, next) {
  try {
    const id = Number(req.params.id);
    const idMatiere = Number(req.params.idMatiere);
    await enseignantModel.retirerMatiere(id, idMatiere);
    return res.json({ message: 'Classe retirée.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/professeur/mes-matieres (professeur) — ses classes assignées
export async function mesMatieres(req, res, next) {
  try {
    const matieres = await enseignantModel.mesMatieres(req.session.userId);
    return res.json({ matieres });
  } catch (err) {
    next(err);
  }
}
