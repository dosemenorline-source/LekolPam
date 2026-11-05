// Routes du module « Académie » (système indépendant : propre authentification)
import { Router } from 'express';
import * as academie from '../controllers/academie.controller.js';
import { requireAcademieAdmin } from '../middleware/auth.js';
import { authLimiter, iaPersonnelLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Authentification admin Académie
router.post('/academie/admin/login', authLimiter, academie.adminLogin);
router.post('/academie/admin/logout', academie.adminLogout);
router.get('/academie/admin/me', academie.adminMe);
router.patch('/academie/admin/compte', requireAcademieAdmin, authLimiter, academie.modifierCompte);

// Assistant IA (rédaction) — admin Académie uniquement
router.post('/academie/redaction-ia', requireAcademieAdmin, iaPersonnelLimiter, academie.redactionIA);

// Sections
router.get('/academie', academie.lister);                                  // public
router.post('/academie', requireAcademieAdmin, academie.creer);            // admin Académie
router.put('/academie/:id', requireAcademieAdmin, academie.mettreAJour);   // admin Académie
router.delete('/academie/:id', requireAcademieAdmin, academie.supprimer);  // admin Académie

export default router;
