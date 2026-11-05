import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { lister, creer, revoquer } from '../controllers/invitationEleve.controller.js';

const router = Router();

// Gestion réservée au personnel de l'école : secrétariat, direction, propriétaire.
const personnel = requireRole('proprietaire', 'direction', 'admin');

router.get('/invitations-eleve', personnel, lister);
router.post('/invitations-eleve', personnel, creer);
router.post('/invitations-eleve/:id/revoquer', personnel, revoquer);

export default router;
