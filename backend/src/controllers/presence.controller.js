// Contrôleur — présence quotidienne (scan du QR du badge)
import { marquerPresenceParCode, reinitialiserJour } from '../services/presence.service.js';
import { listerDuJour } from '../models/presence.model.js';

// POST /api/admin/presences/scan (admin/direction) — body { code, type: 'entree'|'sortie' }
export async function scanCtrl(req, res, next) {
  try {
    const code = (req.body.code || '').trim();
    const type = req.body.type === 'sortie' ? 'sortie' : 'entree';
    if (!code) return res.status(400).json({ erreur: 'Code requis.' });

    const r = await marquerPresenceParCode({ code, type, idAdmin: req.session.userId });
    if (!r.ok) return res.status(r.code).json({ erreur: r.erreur });

    return res.json({ eleve: r.eleve, dejaMarque: r.dejaMarque, heure: r.heure, type: r.type });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/presences?niveau= (admin/direction) — liste du jour
export async function listerCtrl(req, res, next) {
  try {
    const niveau = (req.query.niveau || '').trim();
    const presences = await listerDuJour({ niveau: niveau || undefined });
    return res.json({ presences });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/presences/aujourdhui (admin/direction) — efface les pointages du jour
export async function reinitialiserJourCtrl(req, res, next) {
  try {
    const n = await reinitialiserJour();
    return res.json({ message: 'Liste du jour réinitialisée.', supprimes: n });
  } catch (err) {
    next(err);
  }
}
