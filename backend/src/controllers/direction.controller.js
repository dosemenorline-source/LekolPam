// Contrôleur — statistiques d'évolution du site (santé + croissance) +
// rapport mensuel d'activité (direction / secrétariat), avec export CSV.
import { compteurs, croissanceHebdo } from '../services/statistiques.service.js';
import { rapportMensuel } from '../services/rapport.service.js';
import { etatServeur } from '../config/etatServeur.js';
import { courrielConfigure } from '../config/mailer.js';
import { iaConfiguree } from '../config/ia.js';

const LIBELLE_ENTITE = { inscription: 'Inscription', paiement: 'Paiement', document_soumis: 'Document' };
const LIBELLE_ROLE = { admin: 'Secrétariat', direction: 'Direction', proprietaire: 'Propriétaire' };
const dateFr = (v) => (v ? new Date(v).toLocaleString('fr-FR') : '');

// Échappe une valeur pour le CSV (séparateur « ; »).
function cell(v) {
  const s = v == null ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const ligne = (...valeurs) => valeurs.map(cell).join(';');

// GET /api/direction/statistiques (proprietaire)
export async function statistiques(req, res, next) {
  try {
    const [c, croissance] = await Promise.all([compteurs(), croissanceHebdo(8)]);
    return res.json({
      compteurs: c,
      croissance,
      sante: {
        courrielConfigure: courrielConfigure(),
        iaConfiguree: iaConfiguree(),
        ...etatServeur(),
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/direction/rapport?mois=YYYY-MM (proprietaire) — données du rapport mensuel
export async function rapport(req, res, next) {
  try {
    const data = await rapportMensuel(req.query.mois);
    return res.json(data);
  } catch (err) {
    next(err);
  }
}

// GET /api/direction/rapport/export?mois=YYYY-MM (proprietaire) — rapport en CSV (ouvre dans Excel)
export async function rapportCsv(req, res, next) {
  try {
    const { mois, resume, parAgent, connexions } = await rapportMensuel(req.query.mois);

    const lignes = [];
    lignes.push('sep=;'); // aide Excel à reconnaître le séparateur
    lignes.push(ligne('Rapport mensuel — Lekòl Pam', `Mois : ${mois}`));
    lignes.push('');
    lignes.push(ligne('RÉSUMÉ DES ACTIONS'));
    lignes.push(ligne('Type', 'Statut', 'Nombre'));
    for (const r of resume) lignes.push(ligne(LIBELLE_ENTITE[r.entite] || r.entite, r.nouveau_statut, r.n));
    lignes.push('');
    lignes.push(ligne('ACTIVITÉ PAR AGENT (direction / secrétariat)'));
    lignes.push(ligne('Nom', 'Courriel', 'Rôle', 'Inscriptions', 'Paiements', 'Documents', 'Total', 'Dernière action'));
    for (const a of parAgent) {
      lignes.push(ligne(a.nom, a.courriel, LIBELLE_ROLE[a.role] || a.role,
        a.inscriptions, a.paiements, a.documents, a.total, dateFr(a.derniereAction)));
    }
    lignes.push('');
    lignes.push(ligne('CONNEXIONS DU PERSONNEL'));
    lignes.push(ligne('Courriel', 'Connexions', 'Dernière connexion'));
    for (const c of connexions) lignes.push(ligne(c.courriel, c.n, dateFr(c.derniere)));

    // BOM UTF-8 pour que les accents s'affichent correctement dans Excel.
    const csv = `﻿${lignes.join('\r\n')}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rapport-${mois}.csv"`);
    return res.send(csv);
  } catch (err) {
    next(err);
  }
}
