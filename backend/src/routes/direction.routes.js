// Statistiques d'évolution du site — réservé au propriétaire (« Contrôle d'accès »).
import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { statistiques, rapport, rapportCsv } from '../controllers/direction.controller.js';

const router = Router();

router.get('/direction/statistiques', requireRole('proprietaire'), statistiques);
router.get('/direction/rapport', requireRole('proprietaire'), rapport);
router.get('/direction/rapport/export', requireRole('proprietaire'), rapportCsv);

export default router;
