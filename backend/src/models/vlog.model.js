// Modèle Publications du vlog
import { pool } from '../config/db.js';

export async function creer({ titre, contenu, categorie, photoUrl, idVlogAdmin }) {
  const [res] = await pool.query(
    'INSERT INTO publications_vlog (titre, contenu, categorie, photo_url, id_vlog_admin) VALUES (?, ?, ?, ?, ?)',
    [titre, contenu, categorie, photoUrl || null, idVlogAdmin || null]
  );
  return res.insertId;
}

export async function lister() {
  const [rows] = await pool.query(
    'SELECT id, titre, contenu, categorie, photo_url, cree_le FROM publications_vlog ORDER BY cree_le DESC'
  );
  return rows;
}

export async function trouverParId(id) {
  const [rows] = await pool.query('SELECT * FROM publications_vlog WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function supprimer(id) {
  await pool.query('DELETE FROM publications_vlog WHERE id = ?', [id]);
}
