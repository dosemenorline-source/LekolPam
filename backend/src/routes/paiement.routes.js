// Routes du module Paiements + tarifs/école
import { Router } from 'express';
import * as tarif from '../controllers/tarif.controller.js';
import * as fraisDivers from '../controllers/fraisDivers.controller.js';
import * as paiement from '../controllers/paiement.controller.js';
import * as economatAuth from '../controllers/economatAuth.controller.js';
import { requireAuth, requireRole, requireEconomatAdmin, requireAuthOuEconomatAdmin } from '../middleware/auth.js';
import { uploadPreuve, uploadLogo, verifierContenuDocument, verifierContenuImage } from '../config/upload.js';
import { uploadLimiter, authLimiter, paiementLimiter, webhookLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Enveloppe multer -> erreurs 400 propres
function televerserPreuveFichier(req, res, next) {
  uploadPreuve.single('preuve')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ erreur: 'Fichier trop volumineux (max 5 Mo).' });
      if (err.message === 'TYPE_NON_AUTORISE') return res.status(400).json({ erreur: 'Type de fichier non autorisé (PDF, JPG, PNG).' });
      return res.status(400).json({ erreur: 'Échec du téléversement.' });
    }
    verifierContenuDocument(req, res, next);
  });
}

// Enveloppe multer pour le logo (images seulement)
function televerserLogoFichier(req, res, next) {
  uploadLogo.single('logo')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ erreur: 'Fichier trop volumineux (max 5 Mo).' });
      if (err.message === 'TYPE_NON_AUTORISE') return res.status(400).json({ erreur: 'Type de fichier non autorisé (JPG, PNG).' });
      return res.status(400).json({ erreur: 'Échec du téléversement.' });
    }
    verifierContenuImage(req, res, next);
  });
}

// Économat : authentification (système indépendant, hors comptes école)
router.post('/economat/admin/login', authLimiter, economatAuth.adminLogin);
router.post('/economat/admin/logout', economatAuth.adminLogout);
router.get('/economat/admin/me', economatAuth.adminMe);
router.patch('/economat/admin/compte', requireEconomatAdmin, authLimiter, economatAuth.modifierCompte);
router.get('/economat/niveaux', requireEconomatAdmin, tarif.niveaux);

// Tarifs & coordonnées
router.post('/tarifs', requireEconomatAdmin, tarif.creerTarif);
router.get('/tarifs', requireAuthOuEconomatAdmin, tarif.listerTarifs);
router.put('/tarifs/:id', requireEconomatAdmin, tarif.mettreAJourTarif);
router.delete('/tarifs/:id', requireEconomatAdmin, tarif.supprimerTarif);
router.put('/ecole', requireRole('direction'), tarif.definirEcole);
router.get('/ecole/coordonnees', requireAuth, tarif.coordonneesEcole);
router.put('/ecole-entete', requireRole('admin', 'direction'), tarif.majEnteteEcole);
router.put('/ecole-seuil-reussite', requireRole('admin', 'direction'), tarif.majSeuilReussite);
router.post('/ecole/logo', requireRole('direction'), televerserLogoFichier, tarif.televerserLogo);
router.delete('/ecole/logo', requireRole('direction'), tarif.supprimerLogo);
// Logo public (le badge élève, sans compte utilisateur, doit pouvoir l'afficher)
router.get('/ecole/logo', tarif.servirLogo);
// Marque publique (nom + présence d'un logo) — affichée dans l'en-tête du site.
router.get('/ecole/marque', tarif.marqueEcole);

// Frais divers (catalogue géré par l'économat)
router.get('/frais-divers', requireEconomatAdmin, fraisDivers.lister);
router.post('/frais-divers', requireEconomatAdmin, fraisDivers.creer);
router.put('/frais-divers/:id', requireEconomatAdmin, fraisDivers.mettreAJour);
router.delete('/frais-divers/:id', requireEconomatAdmin, fraisDivers.supprimer);

// Webhook plopplop (notification serveur-à-serveur, aucune session) — voir
// paiement.controller.js webhookPlopplop pour le modèle de confiance.
router.post('/paiements/webhook/plopplop', webhookLimiter, paiement.webhookPlopplop);

// Paiements — parent
router.post('/paiements', requireRole('parent'), paiementLimiter, paiement.creer);
router.post('/paiements/:id/preuve', requireRole('parent'), uploadLimiter, televerserPreuveFichier, paiement.televerserPreuve);
router.post('/paiements/:id/paiement-mobile/demarrer', requireRole('parent'), paiementLimiter, paiement.demarrerMobile);
router.post('/paiements/:id/paiement-mobile/confirmer', requireRole('parent'), paiementLimiter, paiement.confirmerMobile);
router.get('/paiements', requireRole('parent'), paiement.listerMiens);

// Propriétaire du paiement (parent) ou admin Économat
router.get('/paiements/:id', requireAuthOuEconomatAdmin, paiement.detail);
router.get('/paiements/:id/preuve', requireAuthOuEconomatAdmin, paiement.servirPreuve);

// Économat (système indépendant)
router.get('/admin/paiements', requireEconomatAdmin, paiement.listerAdmin);
router.patch('/paiements/:id/validation', requireEconomatAdmin, paiement.validation);

export default router;
