// Routes du module « Examens passés » (système indépendant : propre authentification)
import { Router } from 'express';
import * as examens from '../controllers/examens.controller.js';
import { requireExamensAdmin } from '../middleware/auth.js';
import { uploadExamen, verifierContenuImage } from '../config/upload.js';
import { authLimiter, iaLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Enveloppe multer -> erreurs 400 propres (photo requise)
function televerserPhotoExamen(req, res, next) {
  uploadExamen.single('photo')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ erreur: 'Fichier trop volumineux (max 5 Mo).' });
      if (err.message === 'TYPE_NON_AUTORISE') return res.status(400).json({ erreur: 'Type de fichier non autorisé (JPG, PNG).' });
      return res.status(400).json({ erreur: 'Échec du téléversement.' });
    }
    verifierContenuImage(req, res, next);
  });
}

// Authentification admin Examens
router.post('/examens/admin/login', authLimiter, examens.adminLogin);
router.post('/examens/admin/logout', examens.adminLogout);
router.get('/examens/admin/me', examens.adminMe);
router.patch('/examens/admin/compte', requireExamensAdmin, authLimiter, examens.modifierCompte);

// Assistant IA — tuteur pour élève bloqué sur un exercice (public)
router.post('/examens/aide-ia', iaLimiter, examens.aideIA);

// Examens
router.get('/examens', examens.lister);                                          // public
router.get('/examens/:id/photo', examens.servirPhoto);                           // public
router.post('/examens', requireExamensAdmin, televerserPhotoExamen, examens.creer); // admin
router.delete('/examens/:id', requireExamensAdmin, examens.supprimer);           // admin

export default router;
