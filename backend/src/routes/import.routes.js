import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { uploadImport } from '../config/upload.js';
import { champs, analyser, lancer } from '../controllers/import.controller.js';

const router = Router();

// Import de données : secrétariat, direction, propriétaire.
const personnel = requireRole('admin', 'direction', 'proprietaire');

// Enveloppe multer → erreurs 400 propres.
function televerserTableur(req, res, next) {
  uploadImport.single('fichier')(req, res, (err) => {
    if (err) {
      if (err.message === 'TYPE_NON_AUTORISE') {
        return res.status(400).json({ erreur: 'Format non pris en charge. Utilisez un fichier Excel (.xlsx) ou CSV.' });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ erreur: 'Fichier trop volumineux (25 Mo maximum).' });
      }
      return res.status(400).json({ erreur: 'Téléversement invalide.' });
    }
    next();
  });
}

router.get('/import/champs', personnel, champs);
router.post('/import/analyser', personnel, uploadLimiter, televerserTableur, analyser);
router.post('/import/:type', personnel, lancer);

export default router;
