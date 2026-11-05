// Modèle — messages du formulaire de contact public
import { pool } from '../config/db.js';

export async function creer({ nom, courriel, message }) {
  const [r] = await pool.query(
    'INSERT INTO messages_contact (nom, courriel, message) VALUES (?, ?, ?)',
    [nom, courriel, message],
  );
  return r.insertId;
}

export async function lister({ statut } = {}) {
  const clauses = [];
  const params = [];
  if (statut) { clauses.push('statut = ?'); params.push(statut); }
  const ou = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [lignes] = await pool.query(
    `SELECT id, nom, courriel, message, statut, cree_le, repondu_le
       FROM messages_contact ${ou} ORDER BY cree_le DESC`,
    params,
  );
  return lignes;
}

export async function trouverParId(id) {
  const [[ligne]] = await pool.query('SELECT * FROM messages_contact WHERE id = ?', [id]);
  return ligne || null;
}

export async function marquerLu(id) {
  await pool.query("UPDATE messages_contact SET statut = 'lu' WHERE id = ? AND statut = 'non_lu'", [id]);
}

export async function enregistrerReponse(id, { reponse, renduPar }) {
  await pool.query(
    `UPDATE messages_contact
        SET statut = 'repondu', reponse = ?, repondu_par = ?, repondu_le = NOW()
      WHERE id = ?`,
    [reponse, renduPar, id],
  );
}
