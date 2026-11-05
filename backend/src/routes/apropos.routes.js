// Routes du module « À propos » (système indépendant : propre authentification)
import { Router } from 'express';
import * as apropos from '../controllers/apropos.controller.js';
import { requireAproposAdmin } from '../middleware/auth.js';
import { authLimiter, iaPersonnelLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Authentification admin À propos
router.post('/apropos/admin/login', authLimiter, apropos.adminLogin);
router.post('/apropos/admin/logout', apropos.adminLogout);
router.get('/apropos/admin/me', apropos.adminMe);
router.patch('/apropos/admin/compte', requireAproposAdmin, authLimiter, apropos.modifierCompte);

// Assistant IA (rédaction) — admin À propos uniquement
router.post('/apropos/redaction-ia', requireAproposAdmin, iaPersonnelLimiter, apropos.redactionIA);

// Sections
router.get('/apropos', apropos.lister);                                  // public
router.post('/apropos', requireAproposAdmin, apropos.creer);             // admin À propos
router.put('/apropos/:id', requireAproposAdmin, apropos.mettreAJour);    // admin À propos
router.delete('/apropos/:id', requireAproposAdmin, apropos.supprimer);   // admin À propos

export default router;
