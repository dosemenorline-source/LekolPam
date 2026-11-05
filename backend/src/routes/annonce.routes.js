import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { authLimiter, iaPersonnelLimiter } from '../middleware/rateLimit.js';
import { envoyerAnnonce, envoyerAnnonceCourriel, redactionAnnonceIA } from '../controllers/annonce.controller.js';

const router = Router();

router.post('/annonces/sms', requireRole('admin', 'direction', 'proprietaire'), authLimiter, envoyerAnnonce);
router.post('/annonces/courriel', requireRole('proprietaire'), authLimiter, envoyerAnnonceCourriel);
router.post('/annonces/redaction-ia', requireRole('proprietaire'), iaPersonnelLimiter, redactionAnnonceIA);

export default router;
