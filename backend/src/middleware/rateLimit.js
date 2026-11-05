// Limitation du taux de requêtes sur les endpoints sensibles
import rateLimit from 'express-rate-limit';

// Auth (login/register) : 10 tentatives / 15 min par IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives. Réessayez plus tard.' },
});

// OTP (vérification / renvoi de code) : 15 requêtes / 15 min par IP
// (anti brute-force sur le code + anti spam sur le renvoi de courriel)
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de requêtes. Réessayez plus tard.' },
});

// Téléversement de documents : 30 fichiers / 15 min par IP
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de téléversements. Réessayez plus tard.' },
});

// Formulaire de contact public : 5 messages / 15 min par IP (anti-spam)
export const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de messages envoyés. Réessayez plus tard.' },
});

// Assistant IA public (aide aux examens) : 15 questions / 15 min par IP —
// évite qu'un usage automatisé n'épuise le quota/budget de l'API IA.
export const iaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: "Trop de questions à l'assistant. Réessayez plus tard." },
});

// Assistants IA du personnel (rédaction, messages) : 40 demandes / 15 min par
// IP — même sans public, une session volée ou un script ne doit pas pouvoir
// épuiser le quota de l'API IA.
export const iaPersonnelLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: "Trop de demandes à l'assistant IA. Réessayez plus tard." },
});

// Création/démarrage/confirmation de paiement : 20 requêtes / 15 min par IP —
// bucket dédié (distinct d'authLimiter) pour qu'un usage automatisé sur les
// paiements (tentative d'exploitation en série) ne partage pas son quota avec
// les tentatives de connexion, et inversement.
export const paiementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de requêtes de paiement. Réessayez plus tard.' },
});

// Synchronisation des postes (pull/push machine-à-machine) : plafond par
// POSTE (pas par IP — plusieurs postes d'une école partagent souvent une
// même IP derrière le routeur). Généreux : un poste peut enchaîner plusieurs
// lots lors d'un rattrapage, mais pas marteler le serveur.
export const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.noeudSync ? `noeud:${req.noeudSync.id}` : req.ip),
  message: { erreur: 'Trop de requêtes de synchronisation. Réessayez dans un instant.' },
});

// Webhook plopplop (notification serveur-à-serveur, pas d'utilisateur derrière) :
// plafond large, juste un garde-fou anti-abus basique — la sécurité réelle
// vient de la revérification systématique auprès de plopplop avant toute
// action (voir paiement.controller.js webhookPlopplop), pas de cette limite.
export const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de requêtes.' },
});
