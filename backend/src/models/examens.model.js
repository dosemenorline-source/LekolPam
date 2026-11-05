// Modèle Examens passés (photos de feuilles d'examen, par niveau)
import { pool } from '../config/db.js';

// niveau optionnel : filtre sur un niveau si fourni
export async function lister(niveau) {
  if (niveau) {
    const [rows] = await pool.query(
      'SELECT id, niveau, titre, photo_url, cree_le FROM examens WHERE niveau = ? ORDER BY cree_le DESC',
      [niveau]
    );
    return rows;
  }
  const [rows] = await pool.query(
    'SELECT id, niveau, titre, photo_url, cree_le FROM examens ORDER BY niveau ASC, cree_le DESC'
  );
  return rows;
}

export async function trouverParId(id) {
  const [rows] = await pool.query('SELECT * FROM examens WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function creer({ niveau, titre, photoUrl, idExamensAdmin }) {
  const [res] = await pool.query(
    'INSERT INTO examens (niveau, titre, photo_url, id_examens_admin) VALUES (?, ?, ?, ?)',
    [niveau, titre || null, photoUrl, idExamensAdmin || null]
  );
  return res.insertId;
}

export async function supprimer(id) {
  await pool.query('DELETE FROM examens WHERE id = ?', [id]);
}
