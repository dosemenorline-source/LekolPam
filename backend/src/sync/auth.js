// Authentification des postes de synchronisation.
// Le poste présente son jeton via l'en-tête « Authorization: Bearer <jeton> »
// (ou « X-Sync-Jeton »). Aucune session/cookie : les postes sont des clients
// machine, pas des navigateurs.
import { verifierJeton } from './noeud.model.js';
import { tracer } from '../services/securite.service.js';

export async function requireNoeudSync(req, res, next) {
  try {
    const entete = req.get('authorization') || '';
    const jeton = entete.startsWith('Bearer ')
      ? entete.slice(7).trim()
      : (req.get('x-sync-jeton') || '').trim();

    const noeud = jeton ? await verifierJeton(jeton) : null;
    if (!noeud) {
      tracer('sync_auth_refus', {
        req, details: 'Jeton de synchronisation invalide ou poste désactivé.',
      });
      return res.status(401).json({ erreur: 'Jeton de synchronisation invalide.' });
    }
    req.noeudSync = noeud;
    next();
  } catch (err) {
    next(err);
  }
}
