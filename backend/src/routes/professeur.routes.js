// Routes du module Corps enseignant (système indépendant : propre authentification)
import { Router } from 'express';
import * as prof from '../controllers/professeur.controller.js';
import { requireProfsAdmin } from '../middleware/auth.js';
import { uploadProf, verifierContenuImage } from '../config/upload.js';
import { authLimiter, iaPersonnelLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Enveloppe multer -> erreurs 400 propres (photo optionnelle)
function televerserPhotoProf(req, res, next) {
  uploadProf.single('photo')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ erreur: 'Fichier trop volumineux (max 5 Mo).' });
      if (err.message === 'TYPE_NON_AUTORISE') return res.status(400).json({ erreur: 'Type de fichier non autorisé (JPG, PNG).' });
      return res.status(400).json({ erreur: 'Échec du téléversement.' });
    }
    verifierContenuImage(req, res, next);
  });
}

// Authentification admin enseignants
router.post('/professeurs/admin/login', authLimiter, prof.adminLogin);
router.post('/professeurs/admin/logout', prof.adminLogout);
router.get('/professeurs/admin/me', prof.adminMe);
router.patch('/professeurs/admin/compte', requireProfsAdmin, authLimiter, prof.modifierCompte);

// Assistant IA — rédige le parcours (biographie) d'un professeur
router.post('/professeurs/redaction-ia', requireProfsAdmin, iaPersonnelLimiter, prof.redactionIA);

// Fiches
router.get('/professeurs', prof.lister);                                         // public
router.get('/professeurs/:id/photo', prof.servirPhoto);                          // public
router.post('/professeurs', requireProfsAdmin, televerserPhotoProf, prof.creer); // admin
router.put('/professeurs/:id', requireProfsAdmin, televerserPhotoProf, prof.modifier); // admin
router.delete('/professeurs/:id', requireProfsAdmin, prof.supprimer);            // admin

export default router;
