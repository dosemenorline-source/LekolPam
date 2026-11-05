import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import {
  etat, mesEnfants, reinscrire,
  statutProprietaire, lancer, cloturer,
} from '../controllers/reinscription.controller.js';

const router = Router();

// Parent / tout compte authentifié
router.get('/reinscription/etat', requireAuth, etat);
router.get('/reinscription/mes-enfants', requireRole('parent'), mesEnfants);
router.post('/reinscription', requireRole('parent'), authLimiter, reinscrire);

// Propriétaire : pilotage de la campagne
router.get('/proprietaire/reinscription', requireRole('proprietaire'), statutProprietaire);
router.post('/proprietaire/reinscription/lancer', requireRole('proprietaire'), lancer);
router.post('/proprietaire/reinscription/cloturer', requireRole('proprietaire'), cloturer);

export default router;
