// Modèle Publication de notes (par niveau + trimestre + année)
import { pool } from '../config/db.js';

export async function existe(niveau, anneeScolaire, trimestre) {
  const [rows] = await pool.query(
    `SELECT id FROM publications_notes
      WHERE niveau = ? AND annee_scolaire = ? AND trimestre = ? LIMIT 1`,
    [niveau, anneeScolaire, trimestre]
  );
  return rows.length > 0;
}

export async function creer({ niveau, anneeScolaire, trimestre, publiePar }) {
  const [res] = await pool.query(
    `INSERT INTO publications_notes (niveau, annee_scolaire, trimestre, publie_par)
     VALUES (?, ?, ?, ?)`,
    [niveau, anneeScolaire, trimestre, publiePar || null]
  );
  return res.insertId;
}

export async function lister() {
  const [rows] = await pool.query(
    `SELECT p.*, u.nom AS publie_par_nom
       FROM publications_notes p
       LEFT JOIN utilisateurs u ON u.id = p.publie_par
      ORDER BY p.publie_le DESC`
  );
  return rows;
}

export async function trouverParId(id) {
  const [rows] = await pool.query('SELECT * FROM publications_notes WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function supprimer(id) {
  await pool.query('DELETE FROM publications_notes WHERE id = ?', [id]);
}
