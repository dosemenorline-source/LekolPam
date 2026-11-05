import { Router } from 'express';
import { requirePersonnel } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { uploadArchive } from '../config/upload.js';
import { lister, televerser, telecharger, supprimer } from '../controllers/archive.controller.js';

const router = Router();

// Enveloppe multer → erreurs 400 propres (type non autorisé, fichier trop lourd).
function televerserFichier(req, res, next) {
  uploadArchive.single('fichier')(req, res, (err) => {
    if (err) {
      if (err.message === 'TYPE_NON_AUTORISE') {
        return res.status(400).json({ erreur: 'Type de fichier non autorisé (Excel, Word, PowerPoint, PDF, CSV, image).' });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ erreur: 'Fichier trop volumineux (25 Mo maximum).' });
      }
      return res.status(400).json({ erreur: 'Téléversement invalide.' });
    }
    next();
  });
}

router.get('/archives', requirePersonnel, lister);
router.post('/archives', requirePersonnel, uploadLimiter, televerserFichier, televerser);
router.get('/archives/:id/fichier', requirePersonnel, telecharger);
router.delete('/archives/:id', requirePersonnel, supprimer);

export default router;
