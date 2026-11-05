// Modèle « campagne de ré-inscription » — une campagne active à la fois.
import { pool } from '../config/db.js';

export async function campagneActive() {
  const [[ligne]] = await pool.query(
    `SELECT id, annee_cible, active, lancee_le, cloturee_le, nb_courriels
       FROM reinscription_campagne WHERE active = 1 ORDER BY id DESC LIMIT 1`
  );
  return ligne || null;
}

export async function derniereCampagne() {
  const [[ligne]] = await pool.query(
    `SELECT c.id, c.annee_cible, c.active, c.lancee_le, c.cloturee_le, c.nb_courriels, u.nom AS lancee_par_nom
       FROM reinscription_campagne c
       LEFT JOIN utilisateurs u ON u.id = c.lancee_par
      ORDER BY c.id DESC LIMIT 1`
  );
  return ligne || null;
}

export async function creerCampagne({ anneeCible, lanceePar }) {
  // actif_unique = 'O' pour une campagne active, NULL sinon. Un index UNIQUE sur
  // cette colonne (plusieurs NULL autorisés en MySQL) garantit UNE SEULE campagne
  // active : un second lancement concurrent lève ER_DUP_ENTRY.
  const [res] = await pool.query(
    `INSERT INTO reinscription_campagne (annee_cible, active, actif_unique, lancee_par)
     VALUES (?, 1, 'O', ?)`,
    [anneeCible, lanceePar || null]
  );
  return { id: res.insertId, anneeCible };
}

export async function majNbCourriels(id, nb) {
  await pool.query(`UPDATE reinscription_campagne SET nb_courriels = ? WHERE id = ?`, [nb, id]);
}

export async function cloturerCampagne(id) {
  const [res] = await pool.query(
    `UPDATE reinscription_campagne
        SET active = 0, actif_unique = NULL, cloturee_le = NOW()
      WHERE id = ? AND active = 1`,
    [id]
  );
  return res.affectedRows > 0;
}
