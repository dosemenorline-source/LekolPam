// Statistiques d'évolution du site — pour le tableau de bord direction.
import { pool } from '../config/db.js';
import { eleveVisible } from '../models/eleve.model.js';

export async function compteurs() {
  const [[{ n: totalUtilisateurs }]] = await pool.query('SELECT COUNT(*) n FROM utilisateurs');
  const [parRole] = await pool.query('SELECT role, COUNT(*) n FROM utilisateurs GROUP BY role');
  // Dossiers impayés/annulés exclus : ils n'ont jamais atteint l'école.
  const [parInscriptionStatut] = await pool.query(
    "SELECT statut, COUNT(*) n FROM inscriptions WHERE statut NOT IN ('attente_paiement','annulee') GROUP BY statut"
  );
  const [parPaiementStatut] = await pool.query('SELECT statut, COUNT(*) n FROM paiements GROUP BY statut');
  const [[{ n: totalEleves }]] = await pool.query(`SELECT COUNT(*) n FROM eleves WHERE ${eleveVisible()}`);

  return { totalUtilisateurs, totalEleves, parRole, parInscriptionStatut, parPaiementStatut };
}

// Semaine ISO (lundi -> dimanche), même convention que YEARWEEK(..., 3) en MySQL.
// Encodée en entier AAAA*100+SS (ex. 202631) pour rester triable et comparable.
function semaineISO(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const jour = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - jour);
  const debutAnnee = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semaine = Math.ceil(((d - debutAnnee) / 86400000 + 1) / 7);
  return d.getUTCFullYear() * 100 + semaine;
}

// Nouveaux comptes et nouvelles inscriptions par semaine, sur les N dernières
// semaines. La grille de semaines est générée explicitement (avec des zéros
// pour les semaines sans activité) : un simple GROUP BY omettrait ces
// semaines, ce qui casserait la continuité du graphique d'évolution.
export async function croissanceHebdo(semaines = 8) {
  const [lignesComptes] = await pool.query(
    'SELECT cree_le AS date_ligne FROM utilisateurs WHERE cree_le >= DATE_SUB(CURDATE(), INTERVAL ? WEEK)',
    [semaines]
  );
  const [lignesInscriptions] = await pool.query(
    `SELECT date_soumission AS date_ligne FROM inscriptions
      WHERE date_soumission >= DATE_SUB(CURDATE(), INTERVAL ? WEEK)
        AND statut NOT IN ('attente_paiement','annulee')`,
    [semaines]
  );

  const grille = [];
  const aujourdHui = new Date();
  for (let i = semaines - 1; i >= 0; i -= 1) {
    const d = new Date(aujourdHui);
    d.setDate(d.getDate() - i * 7);
    grille.push(semaineISO(d));
  }
  const grilleUnique = Array.from(new Set(grille)).sort((a, b) => a - b);

  const compterParSemaine = (lignes) => {
    const carte = new Map(grilleUnique.map((s) => [s, 0]));
    for (const { date_ligne: dateLigne } of lignes) {
      const s = semaineISO(new Date(dateLigne));
      if (carte.has(s)) carte.set(s, carte.get(s) + 1);
    }
    return grilleUnique.map((semaine) => ({ semaine, n: carte.get(semaine) }));
  };

  return {
    comptes: compterParSemaine(lignesComptes),
    inscriptions: compterParSemaine(lignesInscriptions),
  };
}
