// Routes de synchronisation MACHINE (poste de bureau ↔ nuage).
// Montées TÔT dans app.js (avant le parseur JSON global à 100 Ko) car un lot
// de synchronisation peut dépasser cette limite ; ce routeur a son propre
// parseur à 5 Mo. Authentification par jeton de poste (pas de session/cookie).
import { Router } from 'express';
import express from 'express';
import { requireNoeudSync } from '../sync/auth.js';
import { syncLimiter } from '../middleware/rateLimit.js';
import { pull, push, fichierSync, iaSync } from '../controllers/sync.controller.js';

const router = Router();

// Auth d'abord (ne lit que l'en-tête) : un lot volumineux n'est même pas
// parsé tant que le poste n'est pas authentifié. Puis quota PAR POSTE, puis
// parsage JSON (limite élargie pour les lots).
router.use(requireNoeudSync);
router.use(syncLimiter);
router.use(express.json({ limit: '5mb', strict: true }));

router.post('/pull', pull);
router.post('/push', push);
router.get('/fichier', fichierSync); // téléchargement d'un fichier (logo, photo…) par le poste
router.post('/ia', iaSync);          // relais des appels IA du poste vers le nuage

export default router;
