// Contrôleur Archive — anciens documents (Excel/Word/PPT/PDF) classés par service.
import fs from 'fs';
import path from 'path';
import { UPLOAD_ROOT } from '../config/upload.js';
import { findById } from '../models/user.model.js';
import { trouverParId as trouverEconomatAdmin } from '../models/economatAdmin.model.js';
import * as archiveModel from '../models/archive.model.js';
import { SERVICES } from '../models/archive.model.js';
import { tracer } from '../services/securite.service.js';

// Service par défaut selon le profil (si non précisé à l'upload).
function serviceParDefaut(req) {
  if (req.session.economatAdminId) return 'economat';
  if (req.session.role === 'direction') return 'direction';
  if (req.session.role === 'admin') return 'secretariat';
  return 'autre';
}

// Nom lisible de la personne qui téléverse (compte école OU admin Économat).
async function nomActeur(req) {
  if (req.session.userId) {
    const u = await findById(req.session.userId);
    return u?.nom || null;
  }
  if (req.session.economatAdminId) {
    const a = await trouverEconomatAdmin(req.session.economatAdminId);
    return a?.email || 'Économat';
  }
  return null;
}

// GET /api/archives?service=... — liste (filtrée par service si fourni).
export async function lister(req, res, next) {
  try {
    const service = SERVICES.includes(req.query.service) ? req.query.service : null;
    res.json({ documents: await archiveModel.lister(service) });
  } catch (err) {
    next(err);
  }
}

// POST /api/archives — téléverse un document (multipart : service, titre, description, fichier).
export async function televerser(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ erreur: 'Fichier requis.' });
    const titre = (req.body.titre || '').toString().trim().slice(0, 200)
      || req.file.originalname.slice(0, 200);
    const description = (req.body.description || '').toString().trim().slice(0, 500) || null;
    const service = SERVICES.includes(req.body.service) ? req.body.service : serviceParDefaut(req);

    // Nom d'origine nettoyé (affichage uniquement ; le fichier est stocké sous un
    // nom aléatoire généré par multer).
    const nomFichier = (req.file.originalname || 'document')
      .replace(/[\r\n\t]/g, ' ').slice(0, 255);
    const chemin = `archives/${req.file.filename}`;

    const id = await archiveModel.creer({
      service, titre, description, nomFichier, chemin,
      typeMime: req.file.mimetype, taille: req.file.size,
      televersePar: req.session.userId || null,
      televerseParNom: await nomActeur(req),
    });
    tracer('archive_document_ajoute', { req, details: `${service} — ${titre}` });
    res.status(201).json({ id, service, titre });
  } catch (err) {
    next(err);
  }
}

// GET /api/archives/:id/fichier — télécharge le fichier (en pièce jointe).
export async function telecharger(req, res, next) {
  try {
    const doc = await archiveModel.trouverParId(Number(req.params.id));
    if (!doc) return res.status(404).json({ erreur: 'Document introuvable.' });

    // Anti-traversal : le chemin stocké doit rester sous UPLOAD_ROOT/archives.
    const racine = path.resolve(UPLOAD_ROOT);
    const cible = path.resolve(racine, doc.chemin);
    if (cible !== racine && !cible.startsWith(racine + path.sep)) {
      return res.status(400).json({ erreur: 'Chemin invalide.' });
    }
    if (!fs.existsSync(cible) || !fs.statSync(cible).isFile()) {
      return res.status(404).json({ erreur: 'Fichier introuvable.' });
    }
    // En pièce jointe (jamais affiché en ligne) → aucun contenu actif ne s'exécute.
    res.download(cible, doc.nom_fichier);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/archives/:id — supprime le document + son fichier.
export async function supprimer(req, res, next) {
  try {
    const doc = await archiveModel.trouverParId(Number(req.params.id));
    if (!doc) return res.status(404).json({ erreur: 'Document introuvable.' });

    await archiveModel.supprimer(doc.id);
    // Supprime le fichier sur disque (best-effort, après contrôle anti-traversal).
    try {
      const racine = path.resolve(UPLOAD_ROOT);
      const cible = path.resolve(racine, doc.chemin);
      if ((cible === racine || cible.startsWith(racine + path.sep)) && fs.existsSync(cible)) {
        fs.unlinkSync(cible);
      }
    } catch { /* fichier déjà absent : on ignore */ }
    tracer('archive_document_supprime', { req, details: `#${doc.id} — ${doc.titre}` });
    res.json({ supprime: true });
  } catch (err) {
    next(err);
  }
}
