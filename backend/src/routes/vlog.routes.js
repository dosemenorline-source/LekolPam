// Routes du module Vlog (système indépendant : propre authentification)
import { Router } from 'express';
import * as vlog from '../controllers/vlog.controller.js';
import { requireVlogAdmin } from '../middleware/auth.js';
import { uploadVlog, verifierContenuImage } from '../config/upload.js';
import { authLimiter, iaPersonnelLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Enveloppe multer -> erreurs 400 propres (photo optionnelle)
function televerserPhotoVlog(req, res, next) {
  uploadVlog.single('photo')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ erreur: 'Fichier trop volumineux (max 5 Mo).' });
      if (err.message === 'TYPE_NON_AUTORISE') return res.status(400).json({ erreur: 'Type de fichier non autorisé (JPG, PNG).' });
      return res.status(400).json({ erreur: 'Échec du téléversement.' });
    }
    verifierContenuImage(req, res, next);
  });
}

// Authentification admin vlog
router.post('/vlog/admin/login', authLimiter, vlog.adminLogin);
router.post('/vlog/admin/logout', vlog.adminLogout);
router.get('/vlog/admin/me', vlog.adminMe);
router.patch('/vlog/admin/compte', requireVlogAdmin, authLimiter, vlog.modifierCompte);

// Assistant IA (rédaction) — admin vlog uniquement
router.post('/vlog/redaction-ia', requireVlogAdmin, iaPersonnelLimiter, vlog.redactionIA);

// Publications
router.get('/vlog', vlog.lister);                                   // public
router.get('/vlog/:id/photo', vlog.servirPhoto);                    // public
router.post('/vlog', requireVlogAdmin, televerserPhotoVlog, vlog.creer);  // admin vlog
router.delete('/vlog/:id', requireVlogAdmin, vlog.supprimer);       // admin vlog

export default router;
