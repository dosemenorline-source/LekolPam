import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { contactLimiter } from '../middleware/rateLimit.js';
import {
  listerNiveauxCtrl, listerCtrl, creerCtrl, mettreAJourCtrl, listerNotesCtrl, creerNotesCtrl,
  genererBulletinCtrl,
} from '../controllers/ancienEleve.controller.js';
import { creerCtrl as creerDemandeCtrl, listerCtrl as listerDemandesCtrl,
  approuverCtrl, refuserCtrl } from '../controllers/demandeAncien.controller.js';

const router = Router();

// Demande publique (ancien élève, sans compte)
router.post('/anciens-eleves/demandes', contactLimiter, creerDemandeCtrl);

// Gestion secrétariat/direction
router.get('/admin/niveaux', requireRole('admin', 'direction'), listerNiveauxCtrl);
router.get('/admin/anciens-eleves', requireRole('admin', 'direction'), listerCtrl);
router.post('/admin/anciens-eleves', requireRole('admin', 'direction'), creerCtrl);
router.patch('/admin/anciens-eleves/:id', requireRole('admin', 'direction'), mettreAJourCtrl);
router.get('/admin/anciens-eleves/:id/notes', requireRole('admin', 'direction'), listerNotesCtrl);
router.post('/admin/anciens-eleves/:id/notes', requireRole('admin', 'direction'), creerNotesCtrl);
router.post('/admin/anciens-eleves/:id/bulletins', requireRole('admin', 'direction'), genererBulletinCtrl);

router.get('/admin/anciens-eleves/demandes', requireRole('admin', 'direction'), listerDemandesCtrl);
router.post('/admin/anciens-eleves/demandes/:id/approuver', requireRole('admin', 'direction'), approuverCtrl);
router.post('/admin/anciens-eleves/demandes/:id/refuser', requireRole('admin', 'direction'), refuserCtrl);

export default router;
