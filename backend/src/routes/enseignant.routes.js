// Routes du module Enseignant — comptes professeur (direction), devoirs/
// documents/horaires (professeur), consultation (élève).
import { Router } from 'express';
import * as enseignant from '../controllers/enseignant.controller.js';
import * as devoir from '../controllers/devoir.controller.js';
import * as documentCours from '../controllers/documentCours.controller.js';
import * as horaireCours from '../controllers/horaireCours.controller.js';
import { requireRole, requireEleve, requireAuthOuEleve } from '../middleware/auth.js';
import { uploadCours, verifierContenuDocument } from '../config/upload.js';

const router = Router();

// Direction : gestion des comptes professeur + assignation des classes (matières)
router.get('/direction/enseignants', requireRole('direction'), enseignant.lister);
router.post('/direction/enseignants', requireRole('direction'), enseignant.creer);
router.patch('/direction/enseignants/:id', requireRole('direction'), enseignant.definirStatut);
router.post('/direction/enseignants/:id/matieres', requireRole('direction'), enseignant.assignerMatiere);
router.delete('/direction/enseignants/:id/matieres/:idMatiere', requireRole('direction'), enseignant.retirerMatiere);

// Professeur : ses classes, devoirs, documents, horaires
router.get('/professeur/mes-matieres', requireRole('professeur'), enseignant.mesMatieres);

router.post('/professeur/devoirs', requireRole('professeur'), devoir.creer);
router.get('/professeur/devoirs', requireRole('professeur'), devoir.listerPourEnseignant);
router.delete('/professeur/devoirs/:id', requireRole('professeur'), devoir.supprimer);

router.post('/professeur/documents', requireRole('professeur'),
  uploadCours.single('fichier'), verifierContenuDocument, documentCours.creer);
router.get('/professeur/documents', requireRole('professeur'), documentCours.listerPourEnseignant);
router.delete('/professeur/documents/:id', requireRole('professeur'), documentCours.supprimer);

router.post('/professeur/horaires', requireRole('professeur'), horaireCours.creer);
router.get('/professeur/horaires', requireRole('professeur'), horaireCours.listerPourEnseignant);
router.put('/professeur/horaires/:id', requireRole('professeur'), horaireCours.mettreAJour);
router.delete('/professeur/horaires/:id', requireRole('professeur'), horaireCours.supprimer);

// Élève : devoirs, documents et horaire de son niveau
router.get('/eleve/devoirs', requireEleve, devoir.listerPourEleve);
router.get('/eleve/documents', requireEleve, documentCours.listerPourEleve);
router.get('/eleve/horaire', requireEleve, horaireCours.listerPourEleve);

// Fichier d'un document de cours — ouvert par un professeur ou un élève connecté
router.get('/documents-cours/:id/fichier', requireAuthOuEleve, documentCours.servirFichier);

export default router;
