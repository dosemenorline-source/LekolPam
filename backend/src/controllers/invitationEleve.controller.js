// Contrôleur des invitations élève — gestion par le secrétariat / la direction /
// le propriétaire. Ces codes permettent de n'autoriser la création d'un compte
// élève qu'aux personnes réellement admises par l'école.
import * as invitationModel from '../models/invitationEleve.model.js';
import { tracer } from '../services/securite.service.js';

// GET /api/invitations-eleve — liste des invitations.
export async function lister(req, res, next) {
  try {
    res.json({ invitations: await invitationModel.lister() });
  } catch (err) {
    next(err);
  }
}

// POST /api/invitations-eleve — génère un code. Corps : { note?, expireJours? }.
export async function creer(req, res, next) {
  try {
    const note = (req.body?.note || '').toString().trim().slice(0, 160) || null;

    // Expiration optionnelle, exprimée en nombre de jours (1 à 365). Absente =
    // pas d'expiration.
    let expireLe = null;
    const jours = Number(req.body?.expireJours);
    if (Number.isFinite(jours) && jours > 0) {
      const d = new Date();
      d.setDate(d.getDate() + Math.min(Math.floor(jours), 365));
      expireLe = d;
    }

    const invitation = await invitationModel.creer({ note, expireLe, creePar: req.session.userId });
    tracer('invitation_eleve_creee', { req, details: note ? `Note : ${note}` : 'Sans note' });
    res.status(201).json({ invitation });
  } catch (err) {
    next(err);
  }
}

// POST /api/invitations-eleve/:id/revoquer — révoque un code non utilisé.
export async function revoquer(req, res, next) {
  try {
    const ok = await invitationModel.revoquer(Number(req.params.id));
    if (!ok) {
      return res.status(409).json({ erreur: 'Invitation introuvable, déjà utilisée ou déjà révoquée.' });
    }
    tracer('invitation_eleve_revoquee', { req, details: `Invitation #${req.params.id}` });
    res.json({ revoque: true });
  } catch (err) {
    next(err);
  }
}
