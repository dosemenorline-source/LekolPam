// Modèle Sections « À propos »
import { pool } from '../config/db.js';

export async function lister() {
  const [rows] = await pool.query(
    'SELECT id, titre, contenu, ordre, cree_le, maj_le FROM apropos_sections ORDER BY ordre ASC, cree_le ASC'
  );
  return rows;
}

export async function trouverParId(id) {
  const [rows] = await pool.query('SELECT * FROM apropos_sections WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

// Ordre suivant (pour placer une nouvelle section en fin de liste par défaut)
export async function prochainOrdre() {
  const [rows] = await pool.query('SELECT COALESCE(MAX(ordre), 0) + 1 AS suivant FROM apropos_sections');
  return rows[0].suivant;
}

export async function creer({ titre, contenu, ordre, idAproposAdmin }) {
  const [res] = await pool.query(
    'INSERT INTO apropos_sections (titre, contenu, ordre, id_apropos_admin) VALUES (?, ?, ?, ?)',
    [titre, contenu, ordre, idAproposAdmin || null]
  );
  return res.insertId;
}

export async function mettreAJour(id, { titre, contenu, ordre }) {
  await pool.query(
    'UPDATE apropos_sections SET titre = ?, contenu = ?, ordre = ? WHERE id = ?',
    [titre, contenu, ordre, id]
  );
}

export async function supprimer(id) {
  await pool.query('DELETE FROM apropos_sections WHERE id = ?', [id]);
}
