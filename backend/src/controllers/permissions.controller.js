// Contrôleur — interrupteurs de permissions gérés par le propriétaire
import bcrypt from 'bcryptjs';
import { listerPermissions, definirPermission } from '../services/permissions.service.js';
import { findByIdAvecHash, findByCourriel, mettreAJourCourriel, mettreAJourMotDePasse } from '../models/user.model.js';
import { tracer } from '../services/securite.service.js';

const COURRIEL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/permissions (tout compte authentifié) — sert au frontend à
// cacher/désactiver les actions correspondantes ; l'application réelle de la
// règle reste côté serveur (requirePermission sur chaque route concernée).
export async function lister(req, res, next) {
  try {
    const permissions = await listerPermissions();
    return res.json({ permissions });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/permissions/:cle (propriétaire uniquement)
export async function basculer(req, res, next) {
  try {
    const autorise = Boolean(req.body.autorise);
    const r = await definirPermission(req.params.cle, autorise, req.session.userId);
    if (!r.ok) return res.status(r.code).json({ erreur: r.erreur });
    tracer('permission_modifiee', { req, sujet: req.params.cle, details: `autorise=${autorise} par utilisateur #${req.session.userId}` });
    return res.json({ message: 'Permission mise à jour.' });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/mon-compte (tout compte école authentifié) — changer son propre
// courriel et/ou mot de passe. Le mot de passe actuel est exigé — sauf pour un
// compte créé uniquement via Google, qui n'en a pas encore : sa session
// authentifiée (déjà prouvée par Google) suffit pour lui en définir un premier.
export async function modifierCompte(req, res, next) {
  try {
    const motDePasseActuel = req.body.motDePasseActuel || '';
    const nouveauCourriel = req.body.nouveauCourriel ? String(req.body.nouveauCourriel).trim().toLowerCase() : null;
    const nouveauMotDePasse = req.body.nouveauMotDePasse || '';

    if (!nouveauCourriel && !nouveauMotDePasse) return res.status(400).json({ erreur: 'Rien à modifier.' });
    if (nouveauCourriel && !COURRIEL_REGEX.test(nouveauCourriel)) return res.status(400).json({ erreur: 'Courriel invalide.' });
    if (nouveauMotDePasse && nouveauMotDePasse.length < 8) {
      return res.status(400).json({ erreur: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
    }

    const utilisateur = await findByIdAvecHash(req.session.userId);
    if (!utilisateur) return res.status(404).json({ erreur: 'Compte introuvable.' });

    if (utilisateur.mot_de_passe_hash) {
      if (!motDePasseActuel) return res.status(400).json({ erreur: 'Mot de passe actuel requis.' });
      const motDePasseValide = await bcrypt.compare(motDePasseActuel, utilisateur.mot_de_passe_hash);
      if (!motDePasseValide) return res.status(401).json({ erreur: 'Mot de passe actuel incorrect.' });
    }

    if (nouveauCourriel && nouveauCourriel !== utilisateur.courriel) {
      const existant = await findByCourriel(nouveauCourriel);
      if (existant) return res.status(409).json({ erreur: 'Ce courriel est déjà utilisé par un autre compte.' });
      await mettreAJourCourriel(utilisateur.id, nouveauCourriel);
      tracer('courriel_modifie', { req, sujet: utilisateur.courriel, details: `nouveau : ${nouveauCourriel}` });
    }
    if (nouveauMotDePasse) {
      const hash = await bcrypt.hash(nouveauMotDePasse, 12);
      await mettreAJourMotDePasse(utilisateur.id, hash);
      tracer('mot_de_passe_modifie', { req, sujet: utilisateur.courriel });
    }

    return res.json({ message: 'Compte mis à jour.' });
  } catch (err) {
    next(err);
  }
}
