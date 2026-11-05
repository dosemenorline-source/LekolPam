// Modèle Sections « Académie » (par niveau)
import { pool } from '../config/db.js';

// niveau optionnel : si fourni, ne renvoie que les sections de ce niveau
export async function lister(niveau) {
  if (niveau) {
    const [rows] = await pool.query(
      'SELECT id, niveau, titre, contenu, ordre, cree_le, maj_le FROM academie_sections WHERE niveau = ? ORDER BY ordre ASC, cree_le ASC',
      [niveau]
    );
    return rows;
  }
  const [rows] = await pool.query(
    'SELECT id, niveau, titre, contenu, ordre, cree_le, maj_le FROM academie_sections ORDER BY niveau ASC, ordre ASC, cree_le ASC'
  );
  return rows;
}

export async function trouverParId(id) {
  const [rows] = await pool.query('SELECT * FROM academie_sections WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

// Ordre suivant pour un niveau donné (place une nouvelle section en fin de liste)
export async function prochainOrdre(niveau) {
  const [rows] = await pool.query(
    'SELECT COALESCE(MAX(ordre), 0) + 1 AS suivant FROM academie_sections WHERE niveau = ?',
    [niveau]
  );
  return rows[0].suivant;
}

export async function creer({ niveau, titre, contenu, ordre, idAcademieAdmin }) {
  const [res] = await pool.query(
    'INSERT INTO academie_sections (niveau, titre, contenu, ordre, id_academie_admin) VALUES (?, ?, ?, ?, ?)',
    [niveau, titre, contenu, ordre, idAcademieAdmin || null]
  );
  return res.insertId;
}

export async function mettreAJour(id, { niveau, titre, contenu, ordre }) {
  await pool.query(
    'UPDATE academie_sections SET niveau = ?, titre = ?, contenu = ?, ordre = ? WHERE id = ?',
    [niveau, titre, contenu, ordre, id]
  );
}

export async function supprimer(id) {
  await pool.query('DELETE FROM academie_sections WHERE id = ?', [id]);
}
