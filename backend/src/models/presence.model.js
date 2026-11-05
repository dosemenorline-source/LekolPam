// Modèle — présence quotidienne (scan du QR du badge, entrée + sortie)
import { pool } from '../config/db.js';

// Marque un élève présent (entrée) pour aujourd'hui. Idempotent : si déjà
// marqué, n'insère rien. Renvoie true si c'est une nouvelle marque (à notifier).
export async function marquerEntree(idEleve, idAdmin) {
  const [r] = await pool.query(
    'INSERT IGNORE INTO presences (id_eleve, date, marque_par) VALUES (?, CURDATE(), ?)',
    [idEleve, idAdmin],
  );
  return r.affectedRows === 1;
}

export async function trouverDuJour(idEleve) {
  const [[ligne]] = await pool.query(
    'SELECT id, heure_arrivee, heure_depart FROM presences WHERE id_eleve = ? AND date = CURDATE()',
    [idEleve],
  );
  return ligne || null;
}

// Marque la sortie d'un élève déjà pointé présent aujourd'hui. Idempotent :
// un re-scan n'écrase pas une heure de sortie déjà enregistrée.
export async function marquerSortie(idEleve) {
  const [r] = await pool.query(
    'UPDATE presences SET heure_depart = NOW() WHERE id_eleve = ? AND date = CURDATE() AND heure_depart IS NULL',
    [idEleve],
  );
  return r.affectedRows === 1;
}

export async function listerDuJour({ niveau } = {}) {
  const clauses = ["p.date = CURDATE()"];
  const params = [];
  if (niveau) { clauses.push('e.niveau = ?'); params.push(niveau); }
  const [lignes] = await pool.query(
    `SELECT p.id, p.id_eleve, e.nom, e.prenom, e.niveau, p.heure_arrivee, p.heure_depart
       FROM presences p JOIN eleves e ON e.id = p.id_eleve
      WHERE ${clauses.join(' AND ')}
      ORDER BY p.heure_arrivee DESC`,
    params,
  );
  return lignes;
}

// Réinitialisation manuelle (secrétariat) : efface les pointages du jour même.
export async function supprimerAujourdhui() {
  const [r] = await pool.query('DELETE FROM presences WHERE date = CURDATE()');
  return r.affectedRows;
}

// Purge automatique (voir server.js) : efface les pointages plus vieux que
// `jours` jours, pour que la table ne grossisse pas indéfiniment.
export async function supprimerAvant(jours) {
  const [r] = await pool.query('DELETE FROM presences WHERE date < DATE_SUB(CURDATE(), INTERVAL ? DAY)', [jours]);
  return r.affectedRows;
}
