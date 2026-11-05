import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { contactLimiter, authLimiter, iaPersonnelLimiter } from '../middleware/rateLimit.js';
import { creerCtrl, listerCtrl, detailCtrl, genererReponseIaCtrl, repondreCtrl }
  from '../controllers/contactMessage.controller.js';

const router = Router();

router.post('/contact', contactLimiter, creerCtrl);

router.get('/proprietaire/messages', requireRole('proprietaire'), listerCtrl);
router.get('/proprietaire/messages/:id', requireRole('proprietaire'), detailCtrl);
router.post('/proprietaire/messages/:id/reponse-ia', requireRole('proprietaire'), iaPersonnelLimiter, genererReponseIaCtrl);
router.post('/proprietaire/messages/:id/repondre', requireRole('proprietaire'), authLimiter, repondreCtrl);

export default router;
