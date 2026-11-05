// Routes d'authentification
import { Router } from 'express';
import {
  register,
  login,
  logout,
  me,
  eleveConnexion,
  motDePasseOublie,
  reinitialiserMotDePasse,
  verifierConnexion,
  renvoyerCodeConnexion,
  googleAuth,
  googleClientId,
} from '../controllers/auth.controller.js';
import {
  optionsEnregistrement, verifierEnregistrement,
  optionsConnexion, verifierConnexionPasskey,
  listerAppareils, supprimerAppareil,
} from '../controllers/webauthn.controller.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// --- Connexion biométrique (WebAuthn / passkeys : Face ID, Touch ID, etc.) ---
// Enregistrement d'un appareil (utilisateur connecté)
router.post('/webauthn/enregistrement/options', requireAuth, optionsEnregistrement);
router.post('/webauthn/enregistrement/verifier', requireAuth, verifierEnregistrement);
// Connexion via passkey (visiteur) — même limite que les autres connexions
router.post('/webauthn/connexion/options', authLimiter, optionsConnexion);
router.post('/webauthn/connexion/verifier', authLimiter, verifierConnexionPasskey);
// Gestion des appareils enregistrés (utilisateur connecté)
router.get('/webauthn/appareils', requireAuth, listerAppareils);
router.delete('/webauthn/appareils/:id', requireAuth, supprimerAppareil);

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/google/client-id', googleClientId);
router.post('/google', authLimiter, googleAuth);
// 2FA parent : 2ᵉ étape (vérification du code) et renvoi de code.
router.post('/verifier-connexion', otpLimiter, verifierConnexion);
router.post('/renvoyer-code-connexion', otpLimiter, renvoyerCodeConnexion);
router.post('/eleve-connexion', authLimiter, eleveConnexion);
router.post('/mot-de-passe-oublie', otpLimiter, motDePasseOublie);
router.post('/reinitialiser-mot-de-passe', otpLimiter, reinitialiserMotDePasse);
// logout et me gèrent aussi bien un compte classique qu'une session élève.
router.post('/logout', logout);
router.get('/me', me);

export default router;
