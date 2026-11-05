// Modèle — demandes d'accès aux résultats soumises par d'anciens élèves
import { pool } from '../config/db.js';

export async function creer({ nom, prenom, dateNaissance, dernierNiveau, anneesFrequentees, courriel, telephone, message }) {
  const [r] = await pool.query(
    `INSERT INTO demandes_anciens_eleves
       (nom, prenom, date_naissance, dernier_niveau, annees_frequentees, courriel, telephone, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [nom, prenom || null, dateNaissance || null, dernierNiveau || null, anneesFrequentees || null, courriel, telephone || null, message || null],
  );
  return r.insertId;
}

export async function lister({ statut } = {}) {
  const clauses = [];
  const params = [];
  if (statut) { clauses.push('statut = ?'); params.push(statut); }
  const ou = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [lignes] = await pool.query(
    `SELECT * FROM demandes_anciens_eleves ${ou} ORDER BY cree_le DESC`,
    params,
  );
  return lignes;
}

export async function trouverParId(id) {
  const [[ligne]] = await pool.query('SELECT * FROM demandes_anciens_eleves WHERE id = ?', [id]);
  return ligne || null;
}

export async function approuver(id, { idEleve, traitePar }) {
  await pool.query(
    `UPDATE demandes_anciens_eleves
        SET statut = 'approuve', id_eleve = ?, traite_par = ?, traite_le = NOW()
      WHERE id = ?`,
    [idEleve, traitePar, id],
  );
}

export async function refuser(id, { traitePar }) {
  await pool.query(
    `UPDATE demandes_anciens_eleves
        SET statut = 'refuse', traite_par = ?, traite_le = NOW()
      WHERE id = ?`,
    [traitePar, id],
  );
}
