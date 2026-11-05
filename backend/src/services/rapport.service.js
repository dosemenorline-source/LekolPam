// Rapport mensuel d'activité du secrétariat et de la direction, pour le
// propriétaire. S'appuie sur l'historique des changements de statut
// (historique_statut) et le journal de sécurité (connexions du personnel).
import { pool } from '../config/db.js';

// Bornes [début, fin[ d'un mois 'YYYY-MM'.
function bornesMois(mois) {
  const [y, m] = mois.split('-').map(Number);
  const debut = `${mois}-01 00:00:00`;
  const suivant = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { debut, fin: `${suivant}-01 00:00:00` };
}

// Valide le format 'YYYY-MM' ; sinon renvoie le mois courant.
export function moisValide(mois) {
  if (typeof mois === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) return mois;
  return new Date().toISOString().slice(0, 7);
}

// Liste des mois (du plus récent au plus ancien) depuis la création du
// système (plus ancien compte) jusqu'au mois courant.
export async function moisDisponibles() {
  const [[{ premier }]] = await pool.query(
    "SELECT DATE_FORMAT(MIN(cree_le), '%Y-%m') AS premier FROM utilisateurs"
  );
  const courant = new Date().toISOString().slice(0, 7);
  const debut = premier || courant;
  const [py, pm] = debut.split('-').map(Number);
  const mois = [];
  let [y, m] = courant.split('-').map(Number);
  while (y > py || (y === py && m >= pm)) {
    mois.push(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
    if (mois.length > 600) break; // garde-fou
  }
  return mois;
}

export async function rapportMensuel(moisBrut) {
  const mois = moisValide(moisBrut);
  const { debut, fin } = bornesMois(mois);

  // Résumé : nombre d'actions par (entité, nouveau statut) sur le mois.
  const [resume] = await pool.query(
    `SELECT entite, nouveau_statut, COUNT(*) AS n
       FROM historique_statut
      WHERE cree_le >= ? AND cree_le < ?
      GROUP BY entite, nouveau_statut
      ORDER BY entite, nouveau_statut`,
    [debut, fin]
  );

  // Activité par agent (comptes direction / admin / propriétaire).
  const [parAgent] = await pool.query(
    `SELECT u.nom, u.courriel, u.role,
            SUM(h.entite = 'inscription') AS inscriptions,
            SUM(h.entite = 'paiement') AS paiements,
            SUM(h.entite = 'document_soumis') AS documents,
            COUNT(*) AS total,
            MAX(h.cree_le) AS derniere_action
       FROM historique_statut h
       JOIN utilisateurs u ON u.id = h.id_auteur
      WHERE h.cree_le >= ? AND h.cree_le < ?
        AND u.role IN ('admin', 'direction', 'proprietaire')
      GROUP BY u.id
      ORDER BY total DESC`,
    [debut, fin]
  );

  // Connexions réussies du personnel (détail du journal : rôle en clair).
  const [connexions] = await pool.query(
    `SELECT sujet AS courriel, COUNT(*) AS n, MAX(cree_le) AS derniere
       FROM journal_securite
      WHERE evenement = 'connexion_reussie' AND cree_le >= ? AND cree_le < ?
        AND (details LIKE 'admin%' OR details LIKE 'direction%' OR details LIKE 'proprietaire%')
      GROUP BY sujet
      ORDER BY n DESC`,
    [debut, fin]
  );

  return {
    mois,
    moisDisponibles: await moisDisponibles(),
    resume: resume.map((r) => ({ ...r, n: Number(r.n) })),
    parAgent: parAgent.map((a) => ({
      nom: a.nom, courriel: a.courriel, role: a.role,
      inscriptions: Number(a.inscriptions), paiements: Number(a.paiements),
      documents: Number(a.documents), total: Number(a.total), derniereAction: a.derniere_action,
    })),
    connexions: connexions.map((c) => ({ courriel: c.courriel, n: Number(c.n), derniere: c.derniere })),
  };
}
