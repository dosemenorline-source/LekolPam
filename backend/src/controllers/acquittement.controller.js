// Contrôleur Acquittement scolarité — géré par le compte Économat (système
// d'authentification indépendant, voir requireEconomatAdmin)
import * as acquittementModel from '../models/acquittement.model.js';
import { trouverParId as trouverEconomatAdminParId } from '../models/economatAdmin.model.js';

const TRIMESTRES = ['1er_trimestre', '2e_trimestre', '3e_trimestre'];

function validerCle({ anneeScolaire, trimestre }) {
  if (!anneeScolaire) return 'anneeScolaire requise.';
  if (!TRIMESTRES.includes(trimestre)) return `Trimestre invalide (${TRIMESTRES.join(', ')}).`;
  return null;
}

// GET /api/admin/acquittements?niveau=&anneeScolaire=&trimestre= (Économat)
export async function lister(req, res, next) {
  try {
    const niveau = (req.query.niveau || '').trim();
    const anneeScolaire = (req.query.anneeScolaire || '').trim();
    const trimestre = (req.query.trimestre || '').trim();

    if (!niveau) return res.status(400).json({ erreur: 'niveau requis.' });
    const erreur = validerCle({ anneeScolaire, trimestre });
    if (erreur) return res.status(400).json({ erreur });

    const eleves = await acquittementModel.listerParNiveau({ niveau, anneeScolaire, trimestre });
    return res.json({ eleves });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/acquittements (Économat) — marque un élève « à jour »
export async function marquer(req, res, next) {
  try {
    const idEleve = Number(req.body.idEleve);
    const anneeScolaire = (req.body.anneeScolaire || '').trim();
    const trimestre = (req.body.trimestre || '').trim();

    if (!Number.isInteger(idEleve) || idEleve <= 0) return res.status(400).json({ erreur: 'idEleve invalide.' });
    const erreur = validerCle({ anneeScolaire, trimestre });
    if (erreur) return res.status(400).json({ erreur });

    // req.session.userId n'existe que pour un compte école (admin/direction) ;
    // cette route n'est accessible qu'au compte Économat (economatAdminId),
    // qui n'a pas d'id compatible avec acquitte_par (FK vers utilisateurs) —
    // on trace donc son e-mail séparément.
    let acquitteParNote = null;
    if (req.session.economatAdminId) {
      const admin = await trouverEconomatAdminParId(req.session.economatAdminId);
      if (admin) acquitteParNote = admin.email;
    }

    await acquittementModel.marquer({
      idEleve, anneeScolaire, trimestre, acquittePar: req.session.userId || null, acquitteParNote,
    });
    return res.status(201).json({ message: 'Élève marqué à jour.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/acquittements (Économat) — retire le statut « à jour »
export async function retirer(req, res, next) {
  try {
    const idEleve = Number(req.body.idEleve);
    const anneeScolaire = (req.body.anneeScolaire || '').trim();
    const trimestre = (req.body.trimestre || '').trim();

    if (!Number.isInteger(idEleve) || idEleve <= 0) return res.status(400).json({ erreur: 'idEleve invalide.' });
    const erreur = validerCle({ anneeScolaire, trimestre });
    if (erreur) return res.status(400).json({ erreur });

    await acquittementModel.retirer({ idEleve, anneeScolaire, trimestre });
    return res.json({ message: 'Statut retiré (non payé).' });
  } catch (err) {
    next(err);
  }
}
