import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { scanCtrl, listerCtrl, reinitialiserJourCtrl } from '../controllers/presence.controller.js';

const router = Router();

router.post('/admin/presences/scan', requireRole('admin', 'direction'), scanCtrl);
router.get('/admin/presences', requireRole('admin', 'direction'), listerCtrl);
router.delete('/admin/presences/aujourdhui', requireRole('admin', 'direction'), reinitialiserJourCtrl);

export default router;
