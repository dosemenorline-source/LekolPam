// Routes du module Inscription
import { Router } from 'express';
import multer from 'multer';
import {
  creer,
  listerMiennes,
  detail,
  televerserDocument,
  listerDocuments,
  servirFichier,
  listerAdmin,
  changerStatutCtrl,
  messageParentIA,
  annuler,
  configInscription,
} from '../controllers/inscription.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadDocument, verifierContenuDocument } from '../config/upload.js';
import { uploadLimiter, iaPersonnelLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Enveloppe multer pour convertir ses erreurs en réponses 400 propres
function televerserFichier(req, res, next) {
  uploadDocument.single('fichier')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ erreur: 'Fichier trop volumineux (max 5 Mo).' });
      }
      if (err.message === 'TYPE_NON_AUTORISE') {
        return res.status(400).json({ erreur: 'Type de fichier non autorisé (PDF, JPG, PNG).' });
      }
      return res.status(400).json({ erreur: 'Échec du téléversement.' });
    }
    verifierContenuDocument(req, res, next);
  });
}

// Parent
router.post('/inscriptions', requireRole('parent'), creer);
router.get('/inscriptions', requireRole('parent'), listerMiennes);
router.get('/inscriptions/config', requireRole('parent'), configInscription);
router.post('/inscriptions/:id/documents', requireRole('parent'), uploadLimiter, televerserFichier, televerserDocument);
router.post('/inscriptions/:id/annuler', requireRole('parent'), annuler);

// Propriétaire ou admin/direction
router.get('/inscriptions/:id', requireAuth, detail);
router.get('/inscriptions/:id/documents', requireAuth, listerDocuments);
router.get('/documents-soumis/:id/fichier', requireAuth, servirFichier);

// Admin / direction
router.get('/admin/inscriptions', requireRole('admin', 'direction'), listerAdmin);
router.patch('/inscriptions/:id/statut', requireRole('admin', 'direction'), changerStatutCtrl);
router.post('/inscriptions/:id/message-ia', requireRole('admin', 'direction'), iaPersonnelLimiter, messageParentIA);

export default router;
