// Contrôleur Document de cours — fichiers déposés par un professeur pour une
// de ses matières (classes). Fichier stocké sur disque via multer (uploadCours,
// voir config/upload.js), nom généré aléatoirement (anti-traversal).
import fs from 'fs/promises';
import path from 'path';
import * as documentCoursModel from '../models/documentCours.model.js';
import { enseigneMatiere } from '../models/enseignant.model.js';
import { trouverParId as trouverEleveParId } from '../models/eleve.model.js';
import { UPLOAD_ROOT } from '../config/upload.js';

// POST /api/professeur/documents (professeur, multipart : fichier)
export async function creer(req, res, next) {
  try {
    const idMatiere = Number(req.body.idMatiere);
    const titre = (req.body.titre || '').trim();

    if (!req.file) return res.status(400).json({ erreur: 'Fichier requis.' });
    if (!Number.isInteger(idMatiere) || idMatiere <= 0 || !titre) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ erreur: 'idMatiere et titre requis.' });
    }

    const autorise = await enseigneMatiere(req.session.userId, idMatiere);
    if (!autorise) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(403).json({ erreur: "Vous n'enseignez pas cette classe." });
    }

    const urlFichier = `cours/${req.file.filename}`;
    const id = await documentCoursModel.creer({
      idMatiere, idEnseignant: req.session.userId, titre, urlFichier,
    });
    return res.status(201).json({ message: 'Document déposé.', id });
  } catch (err) {
    next(err);
  }
}

// GET /api/professeur/documents?idMatiere= (professeur) — ses propres documents
export async function listerPourEnseignant(req, res, next) {
  try {
    const idMatiere = req.query.idMatiere ? Number(req.query.idMatiere) : null;
    const documents = await documentCoursModel.listerPourEnseignant(req.session.userId, idMatiere);
    return res.json({ documents });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/professeur/documents/:id (professeur, ses propres documents seulement)
export async function supprimer(req, res, next) {
  try {
    const doc = await documentCoursModel.trouverParId(Number(req.params.id));
    if (!doc || doc.id_enseignant !== req.session.userId) {
      return res.status(404).json({ erreur: 'Document introuvable.' });
    }
    await documentCoursModel.supprimer(doc.id, req.session.userId);
    const chemin = path.resolve(UPLOAD_ROOT, doc.url_fichier);
    if (chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      await fs.unlink(chemin).catch(() => {});
    }
    return res.json({ message: 'Document supprimé.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/eleve/documents (élève) — documents des matières de son niveau
export async function listerPourEleve(req, res, next) {
  try {
    const eleve = await trouverEleveParId(req.session.eleveId);
    if (!eleve || !eleve.niveau) return res.json({ documents: [] });
    const documents = await documentCoursModel.listerPourNiveau(eleve.niveau);
    return res.json({ documents });
  } catch (err) {
    next(err);
  }
}

// GET /api/documents-cours/:id/fichier (élève ou professeur authentifié) — sert le fichier
export async function servirFichier(req, res, next) {
  try {
    const doc = await documentCoursModel.trouverParId(Number(req.params.id));
    if (!doc) return res.status(404).json({ erreur: 'Document introuvable.' });
    // Isolation : l'élève ne voit que les documents de son niveau, le
    // professeur que les siens ; la direction/l'administration voient tout.
    // Un parent ou un autre professeur n'y a pas accès (404, sans confirmer
    // que le document existe).
    let autorise = false;
    if (req.session.eleveId && req.session.role === 'eleve') {
      const eleve = await trouverEleveParId(req.session.eleveId);
      autorise = !!eleve && !!eleve.niveau && eleve.niveau === doc.niveau;
    } else if (req.session.userId) {
      autorise = doc.id_enseignant === req.session.userId
        || ['admin', 'direction', 'proprietaire'].includes(req.session.role);
    }
    if (!autorise) return res.status(404).json({ erreur: 'Document introuvable.' });
    const chemin = path.resolve(UPLOAD_ROOT, doc.url_fichier);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      return res.status(400).json({ erreur: 'Chemin invalide.' });
    }
    return res.sendFile(chemin);
  } catch (err) {
    next(err);
  }
}
