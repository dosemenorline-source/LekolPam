import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { lister, basculer, modifierCompte } from '../controllers/permissions.controller.js';

const router = Router();

router.get('/permissions', requireAuth, lister);
router.patch('/permissions/:cle', requireRole('proprietaire'), basculer);
// Changer son propre courriel/mot de passe — tout compte école authentifié
// (parent, admin, direction, propriétaire).
router.patch('/mon-compte', requireAuth, authLimiter, modifierCompte);

export default router;
