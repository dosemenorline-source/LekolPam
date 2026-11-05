// Middleware de contrôle d'accès — appliqué CÔTÉ SERVEUR (pas seulement à l'écran)
import { estAutorise } from '../services/permissions.service.js';

// Régénère l'ID de session (nouvel identifiant côté store) avant d'y écrire une
// identité authentifiée — empêche la fixation de session (un ID de session
// choisi/connu avant la connexion ne doit jamais devenir un ID authentifié).
export function regenererSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

// Exige une session valide
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ erreur: 'Authentification requise.' });
  }
  next();
}

// Exige un des rôles autorisés. Usage : requireRole('admin', 'direction')
export function requireRole(...rolesAutorises) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ erreur: 'Authentification requise.' });
    }
    if (!rolesAutorises.includes(req.session.role)) {
      return res.status(403).json({ erreur: 'Accès refusé pour ce rôle.' });
    }
    next();
  };
}

// Exige une session « espace élève » (connexion par code, sans compte utilisateur)
export function requireEleve(req, res, next) {
  if (!req.session || !req.session.eleveId || req.session.role !== 'eleve') {
    return res.status(401).json({ erreur: 'Connexion élève requise.' });
  }
  next();
}

// Exige une session « admin du vlog » (système indépendant, hors comptes école)
export function requireVlogAdmin(req, res, next) {
  if (!req.session || !req.session.vlogAdminId) {
    return res.status(401).json({ erreur: 'Connexion admin vlog requise.' });
  }
  next();
}

// Exige une session « admin du corps enseignant » (système indépendant, hors comptes école)
export function requireProfsAdmin(req, res, next) {
  if (!req.session || !req.session.profsAdminId) {
    return res.status(401).json({ erreur: 'Connexion admin enseignants requise.' });
  }
  next();
}

// Exige une session « admin de la page À propos » (système indépendant, hors comptes école)
export function requireAproposAdmin(req, res, next) {
  if (!req.session || !req.session.aproposAdminId) {
    return res.status(401).json({ erreur: 'Connexion admin À propos requise.' });
  }
  next();
}

// Exige une session « admin de la section Académie » (système indépendant, hors comptes école)
export function requireAcademieAdmin(req, res, next) {
  if (!req.session || !req.session.academieAdminId) {
    return res.status(401).json({ erreur: 'Connexion admin Académie requise.' });
  }
  next();
}

// Exige une session « admin des examens passés » (système indépendant, hors comptes école)
export function requireExamensAdmin(req, res, next) {
  if (!req.session || !req.session.examensAdminId) {
    return res.status(401).json({ erreur: 'Connexion admin Examens requise.' });
  }
  next();
}

// Exige une session « admin de l'Économat » (système indépendant, hors comptes
// école — détaché des rôles admin/direction : paiements, tarifs, acquittements)
export function requireEconomatAdmin(req, res, next) {
  if (!req.session || !req.session.economatAdminId) {
    return res.status(401).json({ erreur: 'Connexion admin Économat requise.' });
  }
  next();
}

// Lecture de tarifs/frais partagée entre les comptes école (parents...) et
// l'admin Économat (système indépendant) — accepte l'une ou l'autre session.
export function requireAuthOuEconomatAdmin(req, res, next) {
  if (req.session && (req.session.userId || req.session.economatAdminId)) return next();
  return res.status(401).json({ erreur: 'Authentification requise.' });
}

// Personnel de l'école : secrétariat (admin), direction, propriétaire OU admin
// Économat (session indépendante). Exclut parents et élèves. Sert à l'archive
// de documents partagée entre ces services.
const ROLES_PERSONNEL = ['admin', 'direction', 'proprietaire'];
export function requirePersonnel(req, res, next) {
  if (req.session && (req.session.economatAdminId || ROLES_PERSONNEL.includes(req.session.role))) {
    return next();
  }
  return res.status(403).json({ erreur: "Accès réservé au personnel de l'école." });
}

// Exige soit un compte école (professeur y compris, via userId), soit une
// session élève — pour un fichier de cours qu'un professeur et un élève de sa
// classe doivent tous deux pouvoir ouvrir.
export function requireAuthOuEleve(req, res, next) {
  if (req.session && (req.session.userId || (req.session.eleveId && req.session.role === 'eleve'))) {
    return next();
  }
  return res.status(401).json({ erreur: 'Authentification requise.' });
}

// Exige qu'une action ne soit pas désactivée par le propriétaire (voir
// permissions.service.js). À utiliser APRÈS requireRole sur les routes
// direction/admin concernées — le propriétaire lui-même n'emprunte pas ces
// routes, donc ce gate ne s'applique jamais à son propre rôle.
export function requirePermission(cle) {
  return async (req, res, next) => {
    try {
      const ok = await estAutorise(cle);
      if (!ok) {
        return res.status(403).json({ erreur: 'Cette fonctionnalité a été désactivée par le propriétaire de l\'école.' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
