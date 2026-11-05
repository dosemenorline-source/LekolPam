// Routes du module Notes & Bulletins
import { Router } from 'express';
import * as matiere from '../controllers/matiere.controller.js';
import * as note from '../controllers/note.controller.js';
import * as publication from '../controllers/publication.controller.js';
import * as acquittement from '../controllers/acquittement.controller.js';
import { requireAuth, requireRole, requireEleve, requirePermission, requireEconomatAdmin } from '../middleware/auth.js';
import { CLES } from '../services/permissions.service.js';
import { uploadPhoto, verifierContenuImage } from '../config/upload.js';
import { iaLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Matières (Direction configure ; Admin/Direction consultent) — le propriétaire
// peut désactiver la gestion (écriture) sans toucher à la consultation.
router.post('/matieres', requireRole('direction'), requirePermission(CLES.MATIERES), matiere.creer);
router.get('/matieres', requireRole('admin', 'direction'), matiere.lister);
router.patch('/matieres/:id', requireRole('direction'), requirePermission(CLES.MATIERES), matiere.mettreAJour);
router.delete('/matieres/:id', requireRole('direction'), requirePermission(CLES.MATIERES), matiere.supprimer);

// Notes (Admin saisit / valide)
router.post('/notes', requireRole('admin'), requirePermission(CLES.NOTES_SAISIE), note.creer);
router.patch('/notes/:id', requireRole('admin'), requirePermission(CLES.NOTES_SAISIE), note.mettreAJour);
router.delete('/notes/:id', requireRole('admin'), requirePermission(CLES.NOTES_SAISIE), note.supprimer);
router.patch('/notes/:id/valider', requireRole('admin'), requirePermission(CLES.NOTES_SAISIE), note.valider);
router.get('/admin/notes', requireRole('admin', 'direction'), note.listerAdmin);
router.get('/admin/eleves', requireRole('admin', 'direction'), note.listerElevesAdmin);

// Secrétariat : registre des codes d'accès élèves (consultation + génération)
router.get('/admin/eleves-codes', requireRole('admin', 'direction'), note.listerElevesCodes);
router.post('/admin/eleves/:id/code-acces', requireRole('admin', 'direction'), note.genererCodeAccesAdmin);

// Secrétariat : badges élèves (consultation, photo, impression)
router.get('/admin/eleves/:id/badge', requireRole('admin', 'direction'), note.badgeEleveAdmin);
router.patch('/admin/eleves/:id/badge-infos', requireRole('admin', 'direction'), note.majInfosBadgeEleve);
router.get('/admin/eleves/:id/photo', requireRole('admin', 'direction'), note.servirPhotoEleveAdmin);
router.post('/admin/eleves/:id/photo', requireRole('admin', 'direction'), uploadPhoto.single('photo'), verifierContenuImage, note.televerserPhotoEleveAdmin);

// Économat : acquittement de scolarité par trimestre (système indépendant)
router.get('/admin/acquittements', requireEconomatAdmin, acquittement.lister);
router.post('/admin/acquittements', requireEconomatAdmin, acquittement.marquer);
router.delete('/admin/acquittements', requireEconomatAdmin, acquittement.retirer);

// Liste des enfants du parent connecté
router.get('/mes-eleves', requireRole('parent'), note.listerMesEleves);

// Parent : génère le code d'accès de l'espace élève pour un de ses enfants
router.post('/eleves/:id/code-acces', requireRole('parent'), note.genererCodeAccesEleve);

// Espace élève (connexion par code) — lecture seule
router.get('/eleve/mes-notes', requireEleve, note.listerMesNotesEleve);
router.get('/eleve/mes-bulletins', requireEleve, publication.listerMesBulletinsEleve);
// Appréciation IA d'un trimestre (critique du bulletin/résultats)
router.post('/eleve/appreciation-ia', requireEleve, iaLimiter, note.appreciationIaEleve);

// Espace élève — badge & photo
router.get('/eleve/badge', requireEleve, note.badgeEleve);
router.post('/eleve/photo', requireEleve, uploadPhoto.single('photo'), verifierContenuImage, note.televerserPhotoEleve);
router.get('/eleve/photo', requireEleve, note.servirPhotoEleve);

// Consultation des notes d'un élève (propriétaire ou admin/direction)
router.get('/eleves/:id/notes', requireAuth, note.listerPourEleve);

// Publication (Direction)
router.post('/publications', requireRole('direction'), requirePermission(CLES.NOTES_PUBLICATION), publication.publierCtrl);
router.get('/publications', requireRole('admin', 'direction'), publication.lister);
router.delete('/publications/:id', requireRole('direction'), requirePermission(CLES.NOTES_PUBLICATION), publication.supprimerCtrl);
router.get('/admin/bulletins', requireRole('admin', 'direction'), publication.listerBulletinsNiveau);

// Bulletins & documents officiels
router.get('/eleves/:id/bulletins', requireAuth, publication.listerBulletins);
router.get('/eleves/:id/documents-officiels', requireAuth, publication.listerDocumentsOfficiels);
// Le fichier : servirFichier gère lui-même l'accès (admin, parent propriétaire, ou l'élève).
router.get('/documents-officiels/:id/fichier', publication.servirFichier);

export default router;
