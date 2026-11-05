// Contrôleur — authentification admin Économat (système indépendant)
import bcrypt from 'bcryptjs';
import { comparerMotDePasse } from '../utils/motDePasse.js';
import { adminBloque, adminEchec, adminSucces } from '../services/securite.service.js';
import * as adminModel from '../models/economatAdmin.model.js';
import { regenererSession } from '../middleware/auth.js';

const COURRIEL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/economat/admin/login
export async function adminLogin(req, res, next) {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const motDePasse = req.body.motDePasse || '';
    if (!email || !motDePasse) {
      return res.status(400).json({ erreur: 'Courriel et mot de passe requis.' });
    }
    if (!COURRIEL_RE.test(email)) {
      return res.status(400).json({ erreur: 'Courriel invalide.' });
    }

    if (adminBloque('economat', email, req)) {
      return res.status(429).json({ erreur: 'Trop de tentatives pour ce compte. Réessayez plus tard.' });
    }
    const admin = await adminModel.trouverParEmail(email);

    const ok = await comparerMotDePasse(motDePasse, admin?.mot_de_passe_hash);
    if (!admin || !ok) {
      adminEchec('economat', email, req);
      return res.status(401).json({ erreur: 'Identifiants invalides.' });
    }
    adminSucces('economat', email, req);

    await regenererSession(req);
    req.session.economatAdminId = admin.id;
    return res.json({ admin: { id: admin.id, email: admin.email } });
  } catch (err) {
    next(err);
  }
}

// POST /api/economat/admin/logout
export function adminLogout(req, res) {
  delete req.session.economatAdminId;
  return res.json({ message: 'Déconnecté de l\'Économat.' });
}

// GET /api/economat/admin/me
export async function adminMe(req, res, next) {
  try {
    if (!req.session.economatAdminId) return res.status(401).json({ erreur: 'Non authentifié.' });
    const admin = await adminModel.trouverParId(req.session.economatAdminId);
    if (!admin) return res.status(401).json({ erreur: 'Non authentifié.' });
    return res.json({ admin: { id: admin.id, email: admin.email } });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/economat/admin/compte — changer son propre courriel et/ou mot
// de passe. Le mot de passe actuel est toujours exigé.
export async function modifierCompte(req, res, next) {
  try {
    const motDePasseActuel = req.body.motDePasseActuel || '';
    const nouveauEmail = req.body.nouveauEmail ? String(req.body.nouveauEmail).trim().toLowerCase() : null;
    const nouveauMotDePasse = req.body.nouveauMotDePasse || '';

    if (!motDePasseActuel) return res.status(400).json({ erreur: 'Mot de passe actuel requis.' });
    if (!nouveauEmail && !nouveauMotDePasse) return res.status(400).json({ erreur: 'Rien à modifier.' });
    if (nouveauEmail && !COURRIEL_RE.test(nouveauEmail)) return res.status(400).json({ erreur: 'Courriel invalide.' });
    if (nouveauMotDePasse && nouveauMotDePasse.length < 8) {
      return res.status(400).json({ erreur: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
    }

    const admin = await adminModel.trouverParIdAvecHash(req.session.economatAdminId);
    if (!admin) return res.status(404).json({ erreur: 'Compte introuvable.' });

    const motDePasseValide = await bcrypt.compare(motDePasseActuel, admin.mot_de_passe_hash);
    if (!motDePasseValide) return res.status(401).json({ erreur: 'Mot de passe actuel incorrect.' });

    if (nouveauEmail && nouveauEmail !== admin.email) {
      const existant = await adminModel.trouverParEmail(nouveauEmail);
      if (existant) return res.status(409).json({ erreur: 'Ce courriel est déjà utilisé par un autre compte.' });
      await adminModel.mettreAJourEmail(admin.id, nouveauEmail);
    }
    if (nouveauMotDePasse) {
      const hash = await bcrypt.hash(nouveauMotDePasse, 12);
      await adminModel.mettreAJourMotDePasse(admin.id, hash);
    }

    return res.json({ message: 'Compte mis à jour.' });
  } catch (err) {
    next(err);
  }
}
